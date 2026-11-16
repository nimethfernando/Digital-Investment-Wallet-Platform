import crypto from 'crypto';
import { prisma } from '../lib/prisma';

export interface MarketFundamentals {
  marketCap?: string;
  peRatio?: string;
  eps?: string;
  dividendYield?: string;
  beta?: string;
  sector?: string;
  industry?: string;
  analystTarget?: string;
  analystConsensus?: string; // e.g. "18 Buy • 6 Hold • 2 Sell"
  dataSource: string; // e.g. "Finnhub + Yahoo Finance" | "Alpha Vantage + Yahoo Finance" | "Yahoo Finance Live Feed"
}

export interface TechnicalMetrics {
  dayHigh: number | null;
  dayLow: number | null;
  fiftyTwoWeekHigh: number | null;
  fiftyTwoWeekLow: number | null;
  fiftyTwoWeekPct: number | null; // 0..100 position within 52w range
  volume: number | null;
  avgVolume20d: number | null;
  sma20: number | null;
  sma50: number | null;
  rsi14: number | null;
  return3mPct: number | null;
}

export interface MarketQuote {
  symbol: string;
  companyName: string;
  exchange: string;
  currency: string;
  price: number | null;
  prevClose: number | null;
  changeAbs: number | null;
  changePct: number | null;
  priceFormatted: string;
  changeFormatted: string;
  sparkline: number[];
  isCrypto: boolean;
  technicals: TechnicalMetrics;
  fundamentals: MarketFundamentals;
}

export interface RawNewsItem {
  headline: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  publishedAt: Date;
  urlHash: string;
}

export interface HighlightBullet {
  text: string;
  source: string;
  url?: string;
}

export interface BannerSpec {
  kicker: string;
  headline: string;
  subtitle: string;
  ticker: string;
  exchange: string;
  priceText: string;
  changeText: string;
  isPositive: boolean;
  sparkline: number[];
  dayRangeText: string;
  fiftyTwoWeekText: string;
  volumeText: string;
  rsiText: string;
  smaText: string;
  marketCapText: string;
  peText: string;
  dataSource: string;
  technicals?: TechnicalMetrics;
  fundamentals?: MarketFundamentals;
}

export interface MemeSpec {
  template: 'sentiment-matrix' | 'stonks' | 'two-buttons' | 'drake' | 'volatility';
  topText: string;
  bottomText: string;
  ticker: string;
  companyName: string;
  priceText: string;
  changeText: string;
  sentimentScore: number; // 0..100
  sentimentLabel: string;
  bullPoints: string[];
  bearPoints: string[];
  supportLevel: string;
  resistanceLevel: string;
}

const KNOWN_ENTITIES: Record<string, { symbol: string; companyName: string; exchange: string; isCrypto?: boolean }> = {
  apple: { symbol: 'AAPL', companyName: 'Apple Inc.', exchange: 'NASDAQGS' },
  aapl: { symbol: 'AAPL', companyName: 'Apple Inc.', exchange: 'NASDAQGS' },
  tesla: { symbol: 'TSLA', companyName: 'Tesla, Inc.', exchange: 'NASDAQGS' },
  tsla: { symbol: 'TSLA', companyName: 'Tesla, Inc.', exchange: 'NASDAQGS' },
  nvidia: { symbol: 'NVDA', companyName: 'NVIDIA Corporation', exchange: 'NASDAQGS' },
  nvda: { symbol: 'NVDA', companyName: 'NVIDIA Corporation', exchange: 'NASDAQGS' },
  microsoft: { symbol: 'MSFT', companyName: 'Microsoft Corporation', exchange: 'NASDAQGS' },
  msft: { symbol: 'MSFT', companyName: 'Microsoft Corporation', exchange: 'NASDAQGS' },
  amazon: { symbol: 'AMZN', companyName: 'Amazon.com, Inc.', exchange: 'NASDAQGS' },
  amzn: { symbol: 'AMZN', companyName: 'Amazon.com, Inc.', exchange: 'NASDAQGS' },
  google: { symbol: 'GOOGL', companyName: 'Alphabet Inc.', exchange: 'NASDAQGS' },
  alphabet: { symbol: 'GOOGL', companyName: 'Alphabet Inc.', exchange: 'NASDAQGS' },
  googl: { symbol: 'GOOGL', companyName: 'Alphabet Inc.', exchange: 'NASDAQGS' },
  meta: { symbol: 'META', companyName: 'Meta Platforms, Inc.', exchange: 'NASDAQGS' },
  bitcoin: { symbol: 'BTC-USD', companyName: 'Bitcoin (BTC)', exchange: 'CRYPTO', isCrypto: true },
  btc: { symbol: 'BTC-USD', companyName: 'Bitcoin (BTC)', exchange: 'CRYPTO', isCrypto: true },
  ethereum: { symbol: 'ETH-USD', companyName: 'Ethereum (ETH)', exchange: 'CRYPTO', isCrypto: true },
  eth: { symbol: 'ETH-USD', companyName: 'Ethereum (ETH)', exchange: 'CRYPTO', isCrypto: true },
  solana: { symbol: 'SOL-USD', companyName: 'Solana (SOL)', exchange: 'CRYPTO', isCrypto: true },
  sol: { symbol: 'SOL-USD', companyName: 'Solana (SOL)', exchange: 'CRYPTO', isCrypto: true },
  gold: { symbol: 'GC=F', companyName: 'Gold Futures (XAU)', exchange: 'COMEX' },
  xau: { symbol: 'GC=F', companyName: 'Gold Futures (XAU)', exchange: 'COMEX' },
  spy: { symbol: 'SPY', companyName: 'S&P 500 ETF Trust', exchange: 'NYSE ARCA' },
  sp500: { symbol: 'SPY', companyName: 'S&P 500 Index', exchange: 'NYSE' },
  netflix: { symbol: 'NFLX', companyName: 'Netflix, Inc.', exchange: 'NASDAQGS' },
  nflx: { symbol: 'NFLX', companyName: 'Netflix, Inc.', exchange: 'NASDAQGS' },
  amd: { symbol: 'AMD', companyName: 'Advanced Micro Devices', exchange: 'NASDAQGS' },
};

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function decodeXml(input: string): string {
  return input
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function wrapText(text: string, maxChars: number, maxLines: number): string[] {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';

  for (const w of words) {
    const candidate = current ? `${current} ${w}` : w;
    if (candidate.length <= maxChars) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      current = w.length > maxChars ? w.slice(0, maxChars - 1) : w;
      if (lines.length >= maxLines) break;
    }
  }
  if (current && lines.length < maxLines) {
    lines.push(current);
  }
  if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) {
    lines[maxLines - 1] = lines[maxLines - 1].replace(/\.*$/, '').slice(0, Math.max(4, maxChars - 3)) + '...';
  }
  return lines;
}

function formatCompactNumber(num: number | null | undefined, prefix = ''): string {
  if (num === null || num === undefined || Number.isNaN(num)) return 'N/A';
  const abs = Math.abs(num);
  if (abs >= 1e12) return `${prefix}${(num / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${prefix}${(num / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${prefix}${(num / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${prefix}${(num / 1e3).toFixed(1)}K`;
  return `${prefix}${num.toFixed(2)}`;
}

function computeRsi14(closes: number[]): number | null {
  if (closes.length < 15) return null;
  const slice = closes.slice(-15);
  let gains = 0;
  let losses = 0;
  for (let i = 1; i < slice.length; i++) {
    const diff = slice[i] - slice[i - 1];
    if (diff > 0) gains += diff;
    else losses += Math.abs(diff);
  }
  const avgGain = gains / 14;
  const avgLoss = losses / 14;
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}

function classifySentiment(text: string): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  const lower = text.toLowerCase();
  const bullWords = ['surge', 'rally', 'record', 'beat', 'upgrade', 'growth', 'soar', 'buyback', 'trillion', 'gain', 'profit', 'breakout', 'outperform', 'bull', 'strong', 'Jump', 'rise'];
  const bearWords = ['drop', 'fall', 'plunge', 'slump', 'miss', 'downgrade', 'lawsuit', 'probe', 'decline', 'cut', 'loss', 'concern', 'tariff', 'bear', 'risk', 'weak', 'warn'];
  let score = 0;
  for (const w of bullWords) if (lower.includes(w)) score += 1;
  for (const w of bearWords) if (lower.includes(w)) score -= 1;
  if (score > 0) return 'BULLISH';
  if (score < 0) return 'BEARISH';
  return 'NEUTRAL';
}

function hashNewsKey(headline: string, url: string): string {
  const normalized = headline.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 72) || url;
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 48);
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  const suffix = Date.now().toString(36).slice(-5);
  return `${base || 'market-brief'}-${suffix}`;
}

export class AutoContentService {
  private schemaReady = false;

  async ensureSchema(): Promise<void> {
    if (this.schemaReady) return;
    try {
      const cols: Array<{ COLUMN_NAME: string }> = await prisma.$queryRawUnsafe(
        `SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'diw_blog_posts'`
      );
      const existing = new Set(cols.map((c) => c.COLUMN_NAME));

      const missingAlters: Array<[string, string]> = [
        ['category', "ALTER TABLE `diw_blog_posts` ADD COLUMN `category` VARCHAR(80) NOT NULL DEFAULT 'Market Research'"],
        ['tags', 'ALTER TABLE `diw_blog_posts` ADD COLUMN `tags` VARCHAR(500) NULL'],
        ['keyTakeaways', 'ALTER TABLE `diw_blog_posts` ADD COLUMN `keyTakeaways` LONGTEXT NULL'],
        ['ticker', 'ALTER TABLE `diw_blog_posts` ADD COLUMN `ticker` VARCHAR(32) NULL'],
        ['topicQuery', 'ALTER TABLE `diw_blog_posts` ADD COLUMN `topicQuery` VARCHAR(150) NULL'],
        ['bannerSvgUrl', 'ALTER TABLE `diw_blog_posts` ADD COLUMN `bannerSvgUrl` VARCHAR(500) NULL'],
        ['memeUrl', 'ALTER TABLE `diw_blog_posts` ADD COLUMN `memeUrl` VARCHAR(500) NULL'],
        ['bannerData', 'ALTER TABLE `diw_blog_posts` ADD COLUMN `bannerData` LONGTEXT NULL'],
        ['memeData', 'ALTER TABLE `diw_blog_posts` ADD COLUMN `memeData` LONGTEXT NULL'],
        ['highlights', 'ALTER TABLE `diw_blog_posts` ADD COLUMN `highlights` LONGTEXT NULL'],
        ['lastPrice', 'ALTER TABLE `diw_blog_posts` ADD COLUMN `lastPrice` VARCHAR(64) NULL'],
        ['priceChange', 'ALTER TABLE `diw_blog_posts` ADD COLUMN `priceChange` VARCHAR(64) NULL'],
        ['autoTrackNews', 'ALTER TABLE `diw_blog_posts` ADD COLUMN `autoTrackNews` BOOLEAN NOT NULL DEFAULT true'],
        ['lastNewsSync', 'ALTER TABLE `diw_blog_posts` ADD COLUMN `lastNewsSync` DATETIME(3) NULL'],
        ['authorRole', 'ALTER TABLE `diw_blog_posts` ADD COLUMN `authorRole` VARCHAR(150) NULL'],
        ['isFeatured', 'ALTER TABLE `diw_blog_posts` ADD COLUMN `isFeatured` BOOLEAN NOT NULL DEFAULT false'],
      ];

      for (const [colName, sql] of missingAlters) {
        if (!existing.has(colName)) {
          await prisma.$executeRawUnsafe(sql).catch(() => {});
        }
      }

      await prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS \`diw_blog_news_updates\` (
          \`id\` VARCHAR(191) NOT NULL,
          \`postId\` VARCHAR(191) NOT NULL,
          \`headline\` VARCHAR(400) NOT NULL,
          \`summary\` TEXT NOT NULL,
          \`sourceName\` VARCHAR(100) NOT NULL,
          \`sourceUrl\` VARCHAR(600) NOT NULL,
          \`sentiment\` VARCHAR(20) NOT NULL DEFAULT 'NEUTRAL',
          \`urlHash\` VARCHAR(64) NOT NULL,
          \`publishedAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          UNIQUE INDEX \`diw_blog_news_updates_postId_urlHash_key\` (\`postId\`, \`urlHash\`),
          INDEX \`diw_blog_news_updates_postId_publishedAt_idx\` (\`postId\`, \`publishedAt\`),
          PRIMARY KEY (\`id\`),
          CONSTRAINT \`diw_blog_news_updates_postId_fkey\` FOREIGN KEY (\`postId\`) REFERENCES \`diw_blog_posts\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
        ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
      `).catch(() => {});

      this.schemaReady = true;
    } catch (err) {
      console.warn('[AutoContent] ensureSchema note:', err);
    }
  }

  async getAiConfig() {
    const keys = await prisma.cmsSetting.findMany({
      where: {
        key: {
          in: ['ai_openai_api_key', 'ai_gemini_api_key', 'ai_finnhub_api_key', 'ai_alphavantage_api_key'],
        },
      },
    });
    const map: Record<string, string> = {};
    for (const k of keys) map[k.key] = k.value;

    return {
      openaiApiKey: (map.ai_openai_api_key || process.env.OPENAI_API_KEY || '').trim(),
      geminiApiKey: (map.ai_gemini_api_key || process.env.GEMINI_API_KEY || '').trim(),
      finnhubApiKey: (map.ai_finnhub_api_key || process.env.FINNHUB_API_KEY || '').trim(),
      alphaVantageApiKey: (map.ai_alphavantage_api_key || process.env.ALPHAVANTAGE_API_KEY || '').trim(),
    };
  }

  async getPublicAiStatus() {
    const cfg = await this.getAiConfig();
    const providers: string[] = [];
    if (cfg.openaiApiKey) providers.push('OpenAI GPT-4o');
    if (cfg.geminiApiKey) providers.push('Gemini 2.5 Pro/Flash');
    if (cfg.finnhubApiKey) providers.push('Finnhub Institutional API');
    if (cfg.alphaVantageApiKey) providers.push('Alpha Vantage API');
    providers.push('Yahoo Finance v8 OHLCV + Wires');

    return {
      openaiConfigured: Boolean(cfg.openaiApiKey),
      geminiConfigured: Boolean(cfg.geminiApiKey),
      finnhubConfigured: Boolean(cfg.finnhubApiKey),
      alphaVantageConfigured: Boolean(cfg.alphaVantageApiKey),
      engineMode: providers.join(' + '),
    };
  }

  async saveAiConfig(data: {
    openaiApiKey?: string;
    geminiApiKey?: string;
    finnhubApiKey?: string;
    alphaVantageApiKey?: string;
  }) {
    const updates: Array<{ key: string; value: string }> = [];
    if (typeof data.openaiApiKey === 'string') updates.push({ key: 'ai_openai_api_key', value: data.openaiApiKey.trim() });
    if (typeof data.geminiApiKey === 'string') updates.push({ key: 'ai_gemini_api_key', value: data.geminiApiKey.trim() });
    if (typeof data.finnhubApiKey === 'string') updates.push({ key: 'ai_finnhub_api_key', value: data.finnhubApiKey.trim() });
    if (typeof data.alphaVantageApiKey === 'string') {
      updates.push({ key: 'ai_alphavantage_api_key', value: data.alphaVantageApiKey.trim() });
    }

    for (const u of updates) {
      await prisma.cmsSetting.upsert({
        where: { key: u.key },
        update: { value: u.value, group: 'AI_CONTENT' },
        create: { key: u.key, value: u.value, group: 'AI_CONTENT' },
      });
    }
    return this.getPublicAiStatus();
  }

  /**
   * Resolve ticker and pull comprehensive real market data (OHLCV, 52W range, RSI, SMA-20/50, Volume, plus Finnhub & Alpha Vantage fundamentals)
   */
  async resolveTopicAndQuote(topic: string): Promise<MarketQuote> {
    const aiCfg = await this.getAiConfig();
    const cleaned = topic.trim();
    const key = cleaned.toLowerCase().replace(/\b(inc|corp|corporation|stock|shares|news|price)\b/g, '').trim();

    let symbol = '';
    let companyName = cleaned;
    let exchange = 'NASDAQ';
    let isCrypto = false;

    const direct = KNOWN_ENTITIES[key] || KNOWN_ENTITIES[cleaned.toLowerCase()];
    if (direct) {
      symbol = direct.symbol;
      companyName = direct.companyName;
      exchange = direct.exchange;
      isCrypto = Boolean(direct.isCrypto);
    } else if (/^[A-Z]{1,6}(-[A-Z]{2,4})?$/.test(cleaned.toUpperCase())) {
      symbol = cleaned.toUpperCase();
    } else {
      try {
        const res = await fetch(
          `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(cleaned)}&quotesCount=3&newsCount=0`,
          { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(4500) }
        );
        if (res.ok) {
          const json: any = await res.json();
          const first = json?.quotes?.[0];
          if (first?.symbol) {
            symbol = first.symbol;
            companyName = first.longname || first.shortname || cleaned;
            exchange = first.exchDisp || first.exchange || 'MARKET';
            isCrypto = first.quoteType === 'CRYPTOCURRENCY';
          }
        }
      } catch {}
    }

    if (!symbol) {
      symbol = cleaned.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'AAPL';
    }

    let price: number | null = null;
    let prevClose: number | null = null;
    let changePct: number | null = null;
    let changeAbs: number | null = null;
    let currency = 'USD';
    let sparkline: number[] = [];

    const technicals: TechnicalMetrics = {
      dayHigh: null,
      dayLow: null,
      fiftyTwoWeekHigh: null,
      fiftyTwoWeekLow: null,
      fiftyTwoWeekPct: null,
      volume: null,
      avgVolume20d: null,
      sma20: null,
      sma50: null,
      rsi14: null,
      return3mPct: null,
    };

    try {
      const chartRes = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo`,
        { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5500) }
      );
      if (chartRes.ok) {
        const chartJson: any = await chartRes.json();
        const result = chartJson?.chart?.result?.[0];
        const meta = result?.meta;
        const quoteObj = result?.indicators?.quote?.[0];
        const rawCloses: number[] = Array.isArray(quoteObj?.close)
          ? quoteObj.close.filter((n: any) => typeof n === 'number' && !Number.isNaN(n))
          : [];
        const rawVolumes: number[] = Array.isArray(quoteObj?.volume)
          ? quoteObj.volume.filter((n: any) => typeof n === 'number' && !Number.isNaN(n))
          : [];

        if (meta) {
          if (typeof meta.regularMarketPrice === 'number') price = meta.regularMarketPrice;
          if (meta.currency) currency = meta.currency;
          if (meta.fullExchangeName || meta.exchangeName) {
            exchange = meta.fullExchangeName || meta.exchangeName;
          }
          if (meta.longName || meta.shortName) {
            companyName = decodeXml(meta.longName || meta.shortName);
          }
          if (typeof meta.regularMarketDayHigh === 'number') technicals.dayHigh = meta.regularMarketDayHigh;
          if (typeof meta.regularMarketDayLow === 'number') technicals.dayLow = meta.regularMarketDayLow;
          if (typeof meta.fiftyTwoWeekHigh === 'number') technicals.fiftyTwoWeekHigh = meta.fiftyTwoWeekHigh;
          if (typeof meta.fiftyTwoWeekLow === 'number') technicals.fiftyTwoWeekLow = meta.fiftyTwoWeekLow;
          if (typeof meta.regularMarketVolume === 'number') technicals.volume = meta.regularMarketVolume;
        }

        if (rawCloses.length >= 2) {
          sparkline = rawCloses.slice(-30);
          const priorSessionClose = rawCloses[rawCloses.length - 2];
          prevClose = priorSessionClose;
          const currentPrice = price ?? rawCloses[rawCloses.length - 1];
          price = currentPrice;
          changeAbs = currentPrice - priorSessionClose;
          changePct = priorSessionClose > 0 ? (changeAbs / priorSessionClose) * 100 : 0;

          const first3m = rawCloses[0];
          if (first3m > 0) {
            technicals.return3mPct = Number((((currentPrice - first3m) / first3m) * 100).toFixed(2));
          }
          if (rawCloses.length >= 20) {
            const last20 = rawCloses.slice(-20);
            technicals.sma20 = Number((last20.reduce((a, b) => a + b, 0) / 20).toFixed(2));
          }
          if (rawCloses.length >= 50) {
            const last50 = rawCloses.slice(-50);
            technicals.sma50 = Number((last50.reduce((a, b) => a + b, 0) / 50).toFixed(2));
          }
          technicals.rsi14 = computeRsi14(rawCloses);
        }

        if (rawVolumes.length >= 5) {
          const vSlice = rawVolumes.slice(-20);
          technicals.avgVolume20d = Math.round(vSlice.reduce((a, b) => a + b, 0) / vSlice.length);
        }
      }
    } catch {}

    const cleanSymbol = symbol.replace('-USD', '');
    const sourcesUsed: string[] = ['Yahoo Finance v8 OHLCV'];
    const fundamentals: MarketFundamentals = {
      dataSource: 'Yahoo Finance v8 Real-Time Feed',
    };

    // Enrich with Finnhub API if configured
    if (aiCfg.finnhubApiKey && !isCrypto) {
      try {
        const [profRes, metricRes, recRes] = await Promise.allSettled([
          fetch(`https://finnhub.io/api/v1/stock/profile2?symbol=${encodeURIComponent(cleanSymbol)}&token=${encodeURIComponent(aiCfg.finnhubApiKey)}`, { signal: AbortSignal.timeout(4500) }),
          fetch(`https://finnhub.io/api/v1/stock/metric?symbol=${encodeURIComponent(cleanSymbol)}&metric=all&token=${encodeURIComponent(aiCfg.finnhubApiKey)}`, { signal: AbortSignal.timeout(4500) }),
          fetch(`https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(cleanSymbol)}&token=${encodeURIComponent(aiCfg.finnhubApiKey)}`, { signal: AbortSignal.timeout(4500) }),
        ]);

        if (profRes.status === 'fulfilled' && profRes.value.ok) {
          const prof: any = await profRes.value.json();
          if (prof?.marketCapitalization) {
            fundamentals.marketCap = formatCompactNumber(prof.marketCapitalization * 1e6, '$');
            sourcesUsed.push('Finnhub Fundamentals');
          }
          if (prof?.finnhubIndustry) fundamentals.industry = prof.finnhubIndustry;
          if (prof?.name) companyName = prof.name;
        }

        if (metricRes.status === 'fulfilled' && metricRes.value.ok) {
          const mJson: any = await metricRes.value.json();
          const m = mJson?.metric;
          if (m) {
            if (typeof m.peBasicExclExtraTTM === 'number') fundamentals.peRatio = `${m.peBasicExclExtraTTM.toFixed(2)}x`;
            else if (typeof m.peNormalizedAnnual === 'number') fundamentals.peRatio = `${m.peNormalizedAnnual.toFixed(2)}x`;
            if (typeof m.epsBasicExclExtraItemsTTM === 'number') fundamentals.eps = `$${m.epsBasicExclExtraItemsTTM.toFixed(2)}`;
            if (typeof m.dividendYieldIndicatedAnnual === 'number') fundamentals.dividendYield = `${m.dividendYieldIndicatedAnnual.toFixed(2)}%`;
            if (typeof m.beta === 'number') fundamentals.beta = m.beta.toFixed(2);
            if (!technicals.fiftyTwoWeekHigh && typeof m['52WeekHigh'] === 'number') technicals.fiftyTwoWeekHigh = m['52WeekHigh'];
            if (!technicals.fiftyTwoWeekLow && typeof m['52WeekLow'] === 'number') technicals.fiftyTwoWeekLow = m['52WeekLow'];
          }
        }

        if (recRes.status === 'fulfilled' && recRes.value.ok) {
          const recs: any = await recRes.value.json();
          if (Array.isArray(recs) && recs[0]) {
            const r0 = recs[0];
            const buy = (r0.strongBuy || 0) + (r0.buy || 0);
            const hold = r0.hold || 0;
            const sell = (r0.sell || 0) + (r0.strongSell || 0);
            if (buy + hold + sell > 0) {
              fundamentals.analystConsensus = `${buy} Buy • ${hold} Hold • ${sell} Sell`;
            }
          }
        }
      } catch {}
    }

    // Enrich with Alpha Vantage OVERVIEW if configured
    if (aiCfg.alphaVantageApiKey && !isCrypto) {
      try {
        const avRes = await fetch(
          `https://www.alphavantage.co/query?function=OVERVIEW&symbol=${encodeURIComponent(cleanSymbol)}&apikey=${encodeURIComponent(aiCfg.alphaVantageApiKey)}`,
          { signal: AbortSignal.timeout(4500) }
        );
        if (avRes.ok) {
          const av: any = await avRes.json();
          if (av?.Symbol) {
            sourcesUsed.push('Alpha Vantage API');
            if (!fundamentals.marketCap && av.MarketCapitalization) {
              fundamentals.marketCap = formatCompactNumber(Number(av.MarketCapitalization), '$');
            }
            if (!fundamentals.peRatio && av.PERatio && av.PERatio !== 'None') {
              fundamentals.peRatio = `${Number(av.PERatio).toFixed(2)}x`;
            }
            if (!fundamentals.eps && av.EPS && av.EPS !== 'None') {
              fundamentals.eps = `$${Number(av.EPS).toFixed(2)}`;
            }
            if (!fundamentals.dividendYield && av.DividendYield && av.DividendYield !== 'None') {
              fundamentals.dividendYield = `${(Number(av.DividendYield) * 100).toFixed(2)}%`;
            }
            if (!fundamentals.beta && av.Beta && av.Beta !== 'None') {
              fundamentals.beta = Number(av.Beta).toFixed(2);
            }
            if (av.Sector) fundamentals.sector = av.Sector;
            if (av.Industry && !fundamentals.industry) fundamentals.industry = av.Industry;
            if (av.AnalystTargetPrice && av.AnalystTargetPrice !== 'None') {
              fundamentals.analystTarget = `$${Number(av.AnalystTargetPrice).toFixed(2)}`;
            }
          }
        }
      } catch {}
    }

    if (
      price !== null &&
      technicals.fiftyTwoWeekHigh !== null &&
      technicals.fiftyTwoWeekLow !== null &&
      technicals.fiftyTwoWeekHigh > technicals.fiftyTwoWeekLow
    ) {
      technicals.fiftyTwoWeekPct = Math.min(
        100,
        Math.max(
          0,
          Number(
            (((price - technicals.fiftyTwoWeekLow) / (technicals.fiftyTwoWeekHigh - technicals.fiftyTwoWeekLow)) * 100).toFixed(1)
          )
        )
      );
    }

    fundamentals.dataSource = Array.from(new Set(sourcesUsed)).join(' + ');

    const priceFormatted =
      price !== null
        ? `${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
        : 'Live Quote';
    const changeFormatted =
      changePct !== null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '+0.00%';

    return {
      symbol: cleanSymbol,
      companyName,
      exchange,
      currency,
      price,
      prevClose,
      changeAbs,
      changePct,
      priceFormatted,
      changeFormatted,
      sparkline: sparkline.length >= 4 ? sparkline : [100, 102, 101, 104, 103, 106, 108, 107, 111],
      isCrypto,
      technicals,
      fundamentals,
    };
  }

  /**
   * Gather verified market news from Finnhub API, Alpha Vantage News API, Yahoo Finance RSS, and Google News RSS
   */
  async fetchReliableNews(quote: MarketQuote, originalTopic: string, finnhubKey?: string): Promise<RawNewsItem[]> {
    const aiCfg = await this.getAiConfig();
    const activeFinnhub = finnhubKey || aiCfg.finnhubApiKey;
    const items: RawNewsItem[] = [];
    const queryTerm =
      quote.companyName && quote.companyName !== quote.symbol
        ? `${quote.companyName} ${quote.symbol}`
        : originalTopic;

    const parseRss = (xml: string, fallbackSource: string) => {
      const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
      let match: RegExpExecArray | null;
      while ((match = itemRegex.exec(xml)) !== null) {
        const block = match[1];
        const rawTitle = (block.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || '').trim();
        const rawLink = (block.match(/<link>([\s\S]*?)<\/link>/i)?.[1] || '').trim();
        const rawDesc = (block.match(/<description>([\s\S]*?)<\/description>/i)?.[1] || '').trim();
        const rawDate = (block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1] || '').trim();
        const rawSource = (block.match(/<source[^>]*>([\s\S]*?)<\/source>/i)?.[1] || '').trim();

        let headline = decodeXml(rawTitle);
        let sourceName = decodeXml(rawSource) || fallbackSource;

        const dashIdx = headline.lastIndexOf(' - ');
        if (dashIdx > 15 && dashIdx > headline.length - 45) {
          if (!rawSource) sourceName = headline.slice(dashIdx + 3).trim();
          headline = headline.slice(0, dashIdx).trim();
        }

        const sourceUrl = decodeXml(rawLink);
        const summaryText = decodeXml(rawDesc) || headline;
        if (!headline || headline.length < 12 || !sourceUrl) continue;

        const publishedAt = rawDate ? new Date(rawDate) : new Date();
        items.push({
          headline: headline.slice(0, 380),
          summary: (summaryText.length > 25 ? summaryText : headline).slice(0, 600),
          sourceName: sourceName.slice(0, 90),
          sourceUrl: sourceUrl.slice(0, 580),
          sentiment: classifySentiment(`${headline} ${summaryText}`),
          publishedAt: Number.isNaN(publishedAt.getTime()) ? new Date() : publishedAt,
          urlHash: hashNewsKey(headline, sourceUrl),
        });
      }
    };

    const tasks: Promise<void>[] = [
      fetch(
        `https://news.google.com/rss/search?q=${encodeURIComponent(`${queryTerm} when:7d`)}&hl=en-US&gl=US&ceid=US:en`,
        { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5500) }
      )
        .then(async (r) => {
          if (r.ok) parseRss(await r.text(), 'Google News');
        })
        .catch(() => {}),

      fetch(
        `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(quote.isCrypto ? `${quote.symbol}-USD` : quote.symbol)}&region=US&lang=en-US`,
        { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5500) }
      )
        .then(async (r) => {
          if (r.ok) parseRss(await r.text(), 'Yahoo Finance');
        })
        .catch(() => {}),
    ];

    if (activeFinnhub && !quote.isCrypto) {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      tasks.push(
        fetch(
          `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(quote.symbol)}&from=${from}&to=${to}&token=${encodeURIComponent(activeFinnhub)}`,
          { signal: AbortSignal.timeout(5000) }
        )
          .then(async (r) => {
            if (!r.ok) return;
            const arr: any = await r.json();
            if (Array.isArray(arr)) {
              for (const n of arr.slice(0, 12)) {
                if (!n?.headline || !n?.url) continue;
                items.push({
                  headline: String(n.headline).slice(0, 380),
                  summary: String(n.summary || n.headline).slice(0, 600),
                  sourceName: String(n.source || 'Finnhub Wire').slice(0, 90),
                  sourceUrl: String(n.url).slice(0, 580),
                  sentiment: classifySentiment(`${n.headline} ${n.summary || ''}`),
                  publishedAt: n.datetime ? new Date(n.datetime * 1000) : new Date(),
                  urlHash: hashNewsKey(n.headline, n.url),
                });
              }
            }
          })
          .catch(() => {})
      );
    }

    if (aiCfg.alphaVantageApiKey && !quote.isCrypto) {
      tasks.push(
        fetch(
          `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(quote.symbol)}&limit=10&apikey=${encodeURIComponent(aiCfg.alphaVantageApiKey)}`,
          { signal: AbortSignal.timeout(5000) }
        )
          .then(async (r) => {
            if (!r.ok) return;
            const j: any = await r.json();
            if (Array.isArray(j?.feed)) {
              for (const f of j.feed.slice(0, 10)) {
                if (!f?.title || !f?.url) continue;
                const label = String(f.overall_sentiment_label || '').toUpperCase();
                const sent: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = label.includes('BULLISH')
                  ? 'BULLISH'
                  : label.includes('BEARISH')
                  ? 'BEARISH'
                  : classifySentiment(`${f.title} ${f.summary || ''}`);
                items.push({
                  headline: String(f.title).slice(0, 380),
                  summary: String(f.summary || f.title).slice(0, 600),
                  sourceName: String(f.source || 'Alpha Vantage Wire').slice(0, 90),
                  sourceUrl: String(f.url).slice(0, 580),
                  sentiment: sent,
                  publishedAt: new Date(),
                  urlHash: hashNewsKey(f.title, f.url),
                });
              }
            }
          })
          .catch(() => {})
      );
    }

    await Promise.allSettled(tasks);

    const seen = new Set<string>();
    const deduped: RawNewsItem[] = [];
    for (const item of items.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())) {
      if (!seen.has(item.urlHash)) {
        seen.add(item.urlHash);
        deduped.push(item);
      }
    }

    return deduped.slice(0, 15);
  }

  /**
   * Generate Institutional Equity/Asset Research Report + Visual Specs grounded in real market metrics & news
   */
  async generateEditorialPackage(opts: {
    topic: string;
    quote: MarketQuote;
    news: RawNewsItem[];
    categoryOverride?: string;
    includeMeme?: boolean;
  }) {
    const { topic, quote, news, categoryOverride, includeMeme = true } = opts;
    const aiCfg = await this.getAiConfig();
    const t = quote.technicals;
    const f = quote.fundamentals;

    const dayRangeStr =
      t.dayLow !== null && t.dayHigh !== null
        ? `$${t.dayLow.toFixed(2)} – $${t.dayHigh.toFixed(2)}`
        : quote.priceFormatted;
    const w52Str =
      t.fiftyTwoWeekLow !== null && t.fiftyTwoWeekHigh !== null
        ? `$${t.fiftyTwoWeekLow.toFixed(2)} – $${t.fiftyTwoWeekHigh.toFixed(2)} (${t.fiftyTwoWeekPct ?? 50}% of range)`
        : 'N/A';
    const volStr = t.volume !== null ? `${formatCompactNumber(t.volume)} (20D Avg: ${formatCompactNumber(t.avgVolume20d)})` : 'N/A';
    const rsiStr = t.rsi14 !== null ? `${t.rsi14} (${t.rsi14 > 70 ? 'Overbought' : t.rsi14 < 30 ? 'Oversold' : t.rsi14 >= 52 ? 'Bullish Momentum' : 'Neutral'})` : 'N/A';
    const smaStr =
      t.sma20 !== null
        ? `SMA-20: $${t.sma20.toFixed(2)}${t.sma50 !== null ? ` • SMA-50: $${t.sma50.toFixed(2)}` : ''}`
        : 'N/A';

    const metricsSummary = [
      `Asset: ${quote.companyName} (${quote.symbol}) on ${quote.exchange}`,
      `Live Price: ${quote.priceFormatted} (${quote.changeFormatted} 1D change, Prev Close: ${quote.prevClose ? `$${quote.prevClose.toFixed(2)}` : 'N/A'})`,
      `Intraday Range: ${dayRangeStr}`,
      `52-Week Range: ${w52Str}`,
      `3-Month Performance: ${t.return3mPct !== null ? `${t.return3mPct >= 0 ? '+' : ''}${t.return3mPct}%` : 'N/A'}`,
      `Volume: ${volStr}`,
      `Technicals: RSI(14) = ${rsiStr} | ${smaStr}`,
      f.marketCap ? `Market Cap: ${f.marketCap}` : '',
      f.peRatio ? `P/E Ratio: ${f.peRatio} | EPS: ${f.eps || 'N/A'}` : '',
      f.analystConsensus ? `Wall St Consensus: ${f.analystConsensus}` : '',
      f.analystTarget ? `Mean Analyst Target: ${f.analystTarget}` : '',
    ]
      .filter(Boolean)
      .join('\n');

    const newsContext = news
      .slice(0, 8)
      .map((n, i) => `${i + 1}. [${n.sourceName} | ${n.sentiment}] "${n.headline}" — ${n.summary.slice(0, 220)}`)
      .join('\n');

    const systemPrompt = `You are a Managing Director of Equity & Digital Asset Research at Avora Bank.
Write an authoritative, data-dense institutional research note grounded 100% in the real quantitative metrics and verified news headlines provided. Cite exact figures (price, 52-week range, RSI-14, SMA-20/50, volume, market cap, P/E, and specific news sources).
Return ONLY valid JSON matching this schema:
{
  "title": "Institutional research headline citing ticker and key catalyst/trend (max 95 chars)",
  "summary": "2-sentence quantitative executive summary with exact live price, 52W positioning, and top news driver",
  "category": "Equities & Markets | Digital Assets | Macro & Commodities",
  "tags": ["Tag1", "Tag2", "Tag3", "Tag4", "Tag5"],
  "keyTakeaways": ["4-5 data-rich bullet takeaways citing exact numbers and news sources"],
  "contentParagraphs": [
    "## 1. Executive Market Snapshot & Valuation\\nDetailed paragraph analyzing live price, intraday range, 52-week range positioning, volume vs 20D average, and valuation metrics.",
    "## 2. Breaking News & Catalyst Breakdown\\nDetailed synthesis of the actual news stories provided, naming sources (e.g. Reuters, Seeking Alpha, Benzinga, Yahoo Finance) and explaining their fundamental impact.",
    "## 3. Technical Structure & Momentum Analysis\\nQuantitative breakdown of RSI-14, 20-day and 50-day moving averages, 3-month return trajectory, and key support/resistance zones.",
    "## 4. Institutional Bull vs. Bear Thesis & Risk Matrix\\nBalanced institutional outlook weighing upside catalysts against macro, valuation, or execution risks."
  ],
  "todayHighlights": [{"text": "Crisp 1-2 sentence factual highlight with real numbers/events", "source": "Exact source name"}],
  "bullPoints": ["3 concrete data-backed bullish drivers (max 65 chars each)"],
  "bearPoints": ["3 concrete data-backed risk/bearish factors (max 65 chars each)"],
  "deskTakeaway": "Sharp 1-line institutional trading desk verdict (max 75 chars)"
}`;

    const userPrompt = `REAL-TIME QUANTITATIVE DATA:\n${metricsSummary}\n\nVERIFIED BREAKING NEWS WIRES:\n${newsContext || 'No breaking wire stories in the last 24h.'}`;

    let aiParsed: any = null;

    if (aiCfg.openaiApiKey) {
      try {
        const res = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${aiCfg.openaiApiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o-mini',
            temperature: 0.35,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
          signal: AbortSignal.timeout(22000),
        });
        if (res.ok) {
          const data: any = await res.json();
          const txt = data?.choices?.[0]?.message?.content;
          if (txt) aiParsed = JSON.parse(txt);
        }
      } catch (err) {
        console.warn('[AutoContent] OpenAI call fallback:', err);
      }
    }

    if (!aiParsed && aiCfg.geminiApiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(aiCfg.geminiApiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.35 },
            }),
            signal: AbortSignal.timeout(22000),
          }
        );
        if (res.ok) {
          const data: any = await res.json();
          const txt = data?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (txt) aiParsed = JSON.parse(txt);
        }
      } catch (err) {
        console.warn('[AutoContent] Gemini call fallback:', err);
      }
    }

    // Build data-dense, quantitative sections using the real numbers & real news even without LLM key
    const isPositive = (quote.changePct ?? 0) >= 0;
    const priceNum = quote.price ?? 100;
    const supportNum = t.sma20 && t.sma20 < priceNum ? t.sma20 : t.dayLow ?? priceNum * 0.965;
    const resistNum = t.fiftyTwoWeekHigh && t.fiftyTwoWeekHigh >= priceNum ? t.fiftyTwoWeekHigh : (t.dayHigh ?? priceNum * 1.035);

    const bullCount = news.filter((n) => n.sentiment === 'BULLISH').length;
    const bearCount = news.filter((n) => n.sentiment === 'BEARISH').length;
    const rawSentScore = Math.min(
      92,
      Math.max(
        18,
        Math.round(
          50 +
            (quote.changePct ?? 0) * 4 +
            ((t.rsi14 ?? 50) - 50) * 0.5 +
            (bullCount - bearCount) * 5
        )
      )
    );
    const sentimentLabel =
      rawSentScore >= 62 ? 'BULLISH ACCUMULATION' : rawSentScore <= 40 ? 'CAUTIOUS / DEFENSIVE' : 'NEUTRAL CONSOLIDATION';

    const topNews1 = news[0];
    const topNews2 = news[1];
    const topNews3 = news[2];

    const dataDrivenParagraphs = [
      `## 1. Executive Market Snapshot & Valuation\n${quote.companyName} (${quote.symbol}), listed on ${quote.exchange}, is currently trading at ${quote.priceFormatted} (${quote.changeFormatted} in the latest session${quote.prevClose ? ` versus a prior close of $${quote.prevClose.toFixed(2)}` : ''}). Intraday price action has ranged between ${dayRangeStr}, while on a 52-week basis the asset has traded across ${w52Str}. Session volume stands at ${volStr}${f.marketCap ? `, valuing ${quote.symbol} at an implied market capitalization of ${f.marketCap}` : ''}${f.peRatio ? ` with a trailing P/E multiple of ${f.peRatio}` : ''}${f.eps ? ` and diluted EPS of ${f.eps}` : ''}.`,
      `## 2. Breaking News & Institutional Wire Analysis\n${
        topNews1
          ? `Real-time wire monitoring across ${news.length} verified financial feeds highlights active fundamental catalysts for ${quote.symbol}. Leading coverage from ${topNews1.sourceName} reports: "${topNews1.headline}" (${topNews1.summary.slice(0, 220)}).${
              topNews2
                ? ` Concurrently, ${topNews2.sourceName} notes: "${topNews2.headline}",`
                : ''
            }${
              topNews3
                ? ` while ${topNews3.sourceName} adds perspective with "${topNews3.headline}".`
                : ''
            } Across the ${news.length} tracked articles, ${bullCount} register bullish sentiment, ${bearCount} carry bearish risk flags, and ${news.length - bullCount - bearCount} remain neutral.`
          : `Market wire feeds for ${quote.companyName} (${quote.symbol}) currently reflect steady institutional positioning with no disruptive headline shocks in the immediate session window.`
      }`,
      `## 3. Quantitative & Technical Structure (RSI, Moving Averages & Range)\nFrom a quantitative trend perspective, ${quote.symbol} has delivered a 3-month trajectory of ${t.return3mPct !== null ? `${t.return3mPct >= 0 ? '+' : ''}${t.return3mPct}%` : quote.changeFormatted}. The 14-day Relative Strength Index (RSI-14) reads ${rsiStr}. Compared against key trend benchmarks (${smaStr}), ${quote.symbol} is trading ${t.sma20 && quote.price ? (quote.price >= t.sma20 ? `${(((quote.price - t.sma20) / t.sma20) * 100).toFixed(2)}% above its 20-day moving average` : `${(((t.sma20 - quote.price) / t.sma20) * 100).toFixed(2)}% below its 20-day moving average`) : 'near its medium-term equilibrium'}, with immediate technical support near $${supportNum.toFixed(2)} and overhead resistance at $${resistNum.toFixed(2)}.`,
      `## 4. Institutional Bull vs. Bear Thesis & Risk Matrix\n${
        f.analystConsensus
          ? `Wall Street consensus tracked via Finnhub currently stands at ${f.analystConsensus}${f.analystTarget ? ` with a mean target price of ${f.analystTarget}` : ''}. `
          : ''
      }Upside conviction rests on sustained momentum above the $${supportNum.toFixed(2)} support shelf, earnings execution, and institutional inflows when volume expands toward or above the 20-day average (${formatCompactNumber(t.avgVolume20d)}). Key downside risks include resistance rejection near $${resistNum.toFixed(2)}, broader macro rate volatility, and sector multiple compression.`,
    ];

    const title =
      aiParsed?.title ||
      `${quote.companyName} (${quote.symbol}) at ${quote.priceFormatted} (${quote.changeFormatted}): Quantitative Valuation, Technicals & Live Wire Analysis`;

    const summary =
      aiParsed?.summary ||
      `${quote.companyName} (${quote.symbol}) trades at ${quote.priceFormatted} (${quote.changeFormatted}) on ${quote.exchange}, positioned at ${t.fiftyTwoWeekPct ?? 50}% of its 52-week range (${dayRangeStr} intraday) with RSI-14 at ${t.rsi14 ?? 'N/A'} and ${news.length} live wire updates.`;

    const category =
      categoryOverride ||
      aiParsed?.category ||
      (quote.isCrypto ? 'Digital Assets' : 'Equities & Markets');

    const tags: string[] =
      Array.isArray(aiParsed?.tags) && aiParsed.tags.length > 0
        ? aiParsed.tags.slice(0, 6)
        : [quote.symbol, quote.exchange, 'Quantitative Research', 'Technical Analysis', 'Live News'];

    const keyTakeaways: string[] =
      Array.isArray(aiParsed?.keyTakeaways) && aiParsed.keyTakeaways.length > 0
        ? aiParsed.keyTakeaways.slice(0, 5)
        : [
            `Live Quote & Session Range: ${quote.symbol} at ${quote.priceFormatted} (${quote.changeFormatted} 1D), intraday ${dayRangeStr}, volume ${formatCompactNumber(t.volume)} vs 20D avg ${formatCompactNumber(t.avgVolume20d)}.`,
            `52-Week & 3M Positioning: Trading at ${t.fiftyTwoWeekPct ?? 50}% of its 52W range ($${t.fiftyTwoWeekLow?.toFixed(2) ?? 'N/A'} – $${t.fiftyTwoWeekHigh?.toFixed(2) ?? 'N/A'}) with a 3-month return of ${t.return3mPct !== null ? `${t.return3mPct >= 0 ? '+' : ''}${t.return3mPct}%` : quote.changeFormatted}.`,
            `Quantitative Indicators: RSI(14) at ${rsiStr}; ${smaStr}; Support $${supportNum.toFixed(2)} / Resistance $${resistNum.toFixed(2)}.`,
            topNews1
              ? `Primary News Catalyst (${topNews1.sourceName}): "${topNews1.headline}"`
              : `Data Feeds Active: ${f.dataSource}.`,
          ];

    const paragraphs: string[] =
      Array.isArray(aiParsed?.contentParagraphs) && aiParsed.contentParagraphs.length > 0
        ? aiParsed.contentParagraphs
        : dataDrivenParagraphs;

    const highlights: HighlightBullet[] =
      Array.isArray(aiParsed?.todayHighlights) && aiParsed.todayHighlights.length > 0
        ? aiParsed.todayHighlights.slice(0, 5).map((h: any, idx: number) => ({
            text: String(h.text || h),
            source: String(h.source || news[idx]?.sourceName || 'Market Wire'),
            url: news[idx]?.sourceUrl,
          }))
        : news.slice(0, 4).map((n) => ({
            text: n.headline,
            source: n.sourceName,
            url: n.sourceUrl,
          }));

    const banner: BannerSpec = {
      kicker: `AVORA INSTITUTIONAL RESEARCH • ${quote.exchange}`,
      headline: `${quote.companyName} (${quote.symbol})`,
      subtitle: `52W: $${t.fiftyTwoWeekLow?.toFixed(2) ?? '—'} – $${t.fiftyTwoWeekHigh?.toFixed(2) ?? '—'} • Vol: ${formatCompactNumber(t.volume)} • RSI(14): ${t.rsi14 ?? '—'}`,
      ticker: quote.symbol,
      exchange: quote.exchange,
      priceText: quote.priceFormatted,
      changeText: quote.changeFormatted,
      isPositive,
      sparkline: quote.sparkline,
      dayRangeText: dayRangeStr,
      fiftyTwoWeekText:
        t.fiftyTwoWeekLow !== null && t.fiftyTwoWeekHigh !== null
          ? `$${t.fiftyTwoWeekLow.toFixed(2)} – $${t.fiftyTwoWeekHigh.toFixed(2)} (${t.fiftyTwoWeekPct ?? 50}%)`
          : 'N/A',
      volumeText: `${formatCompactNumber(t.volume)} (Avg ${formatCompactNumber(t.avgVolume20d)})`,
      rsiText: rsiStr,
      smaText: smaStr,
      marketCapText: f.marketCap || 'Live Tracking',
      peText: f.peRatio || 'N/A',
      dataSource: f.dataSource,
      technicals: t,
      fundamentals: f,
    };

    const bullPoints: string[] =
      Array.isArray(aiParsed?.bullPoints) && aiParsed.bullPoints.length >= 2
        ? aiParsed.bullPoints.slice(0, 3)
        : [
            t.return3mPct !== null && t.return3mPct > 0
              ? `Strong 3-month momentum (+${t.return3mPct}% trajectory)`
              : `Holding key institutional support near $${supportNum.toFixed(2)}`,
            t.fiftyTwoWeekPct !== null
              ? `Positioned at ${t.fiftyTwoWeekPct}% of 52-week range ($${t.fiftyTwoWeekHigh?.toFixed(2)} high)`
              : `Active liquidity with ${formatCompactNumber(t.volume)} session volume`,
            topNews1 ? `Catalyst (${topNews1.sourceName}): ${topNews1.headline.slice(0, 52)}...` : `RSI-14 at ${t.rsi14 ?? 50} — constructive technical setup`,
          ];

    const bearPoints: string[] =
      Array.isArray(aiParsed?.bearPoints) && aiParsed.bearPoints.length >= 2
        ? aiParsed.bearPoints.slice(0, 3)
        : [
            `Overhead supply resistance near $${resistNum.toFixed(2)} 52W ceiling`,
            t.rsi14 && t.rsi14 > 65
              ? `RSI-14 (${t.rsi14}) approaching elevated momentum territory`
              : `Sensitivity to macro rate expectations & sector rotation`,
            topNews2 ? `Headline watch (${topNews2.sourceName}): ${topNews2.headline.slice(0, 48)}...` : `Intraday volatility across ${dayRangeStr} band`,
          ];

    const meme: MemeSpec = {
      template: 'sentiment-matrix',
      topText: String(aiParsed?.deskTakeaway || `${quote.symbol} QUANTITATIVE SENTIMENT & BULL/BEAR MATRIX`),
      bottomText: `Support: $${supportNum.toFixed(2)}  •  SMA-20: $${t.sma20?.toFixed(2) ?? 'N/A'}  •  Resistance: $${resistNum.toFixed(2)}`,
      ticker: quote.symbol,
      companyName: quote.companyName,
      priceText: quote.priceFormatted,
      changeText: quote.changeFormatted,
      sentimentScore: rawSentScore,
      sentimentLabel,
      bullPoints,
      bearPoints,
      supportLevel: `$${supportNum.toFixed(2)}`,
      resistanceLevel: `$${resistNum.toFixed(2)}`,
    };

    return {
      title,
      summary,
      category,
      tags,
      keyTakeaways,
      content: paragraphs.join('\n\n'),
      readTime: `${Math.max(4, Math.ceil(paragraphs.join(' ').split(/\s+/).length / 170))} min read`,
      highlights,
      banner,
      meme: includeMeme ? meme : null,
      usedAi: Boolean(aiParsed),
    };
  }

  /**
   * End-to-End 1-Click Automated Post & Publisher
   */
  async publishAutomatedPost(params: {
    topic: string;
    includeMeme?: boolean;
    autoTrackNews?: boolean;
    categoryOverride?: string;
  }) {
    const topic = params.topic.trim();
    if (!topic) throw new Error('Topic or ticker symbol is required');
    await this.ensureSchema();

    const aiCfg = await this.getAiConfig();
    const quote = await this.resolveTopicAndQuote(topic);
    const news = await this.fetchReliableNews(quote, topic, aiCfg.finnhubApiKey);
    const pkg = await this.generateEditorialPackage({
      topic,
      quote,
      news,
      categoryOverride: params.categoryOverride,
      includeMeme: params.includeMeme !== false,
    });

    const slug = slugify(`${quote.symbol}-${pkg.title.slice(0, 48)}`);
    const bannerSvgUrl = `/api/v1/cms/media/banner/${slug}.svg`;
    const memeUrl = pkg.meme ? `/api/v1/cms/media/meme/${slug}.svg` : null;

    const post = await prisma.blogPost.create({
      data: {
        slug,
        title: pkg.title.slice(0, 250),
        summary: pkg.summary,
        content: pkg.content,
        coverImage: bannerSvgUrl,
        category: pkg.category,
        tags: pkg.tags.join(', '),
        keyTakeaways: JSON.stringify(pkg.keyTakeaways),
        ticker: quote.symbol,
        topicQuery: topic,
        bannerSvgUrl,
        memeUrl,
        bannerData: JSON.stringify(pkg.banner),
        memeData: pkg.meme ? JSON.stringify(pkg.meme) : null,
        highlights: JSON.stringify(pkg.highlights),
        lastPrice: quote.priceFormatted,
        priceChange: quote.changeFormatted,
        autoTrackNews: params.autoTrackNews !== false,
        lastNewsSync: new Date(),
        authorName: pkg.usedAi ? 'Avora AI Institutional Research' : 'Avora Quantitative Research Desk',
        readTime: pkg.readTime,
        isPublished: true,
        publishedAt: new Date(),
      },
    });

    if (news.length > 0) {
      await prisma.blogNewsUpdate.createMany({
        data: news.map((n) => ({
          postId: post.id,
          headline: n.headline,
          summary: n.summary,
          sourceName: n.sourceName,
          sourceUrl: n.sourceUrl,
          sentiment: n.sentiment,
          urlHash: n.urlHash,
          publishedAt: n.publishedAt,
        })),
        skipDuplicates: true,
      });
    }

    const fullPost = await prisma.blogPost.findUnique({
      where: { id: post.id },
      include: { newsUpdates: { orderBy: { publishedAt: 'desc' }, take: 20 } },
    });

    return {
      post: fullPost,
      stats: {
        tickerResolved: quote.symbol,
        companyName: quote.companyName,
        livePrice: quote.priceFormatted,
        priceChange: quote.changeFormatted,
        newsGathered: news.length,
        usedAi: pkg.usedAi,
        dataSource: quote.fundamentals.dataSource,
        hasMeme: Boolean(memeUrl),
      },
    };
  }

  /**
   * Refresh live quote, quantitative article/banner/sentiment data, and latest news for an existing tracked post
   */
  async syncPostNews(postId: string, regenerateReport = false) {
    await this.ensureSchema();
    const post = await prisma.blogPost.findUnique({ where: { id: postId } });
    if (!post || (!post.ticker && !post.topicQuery)) return null;

    const aiCfg = await this.getAiConfig();
    const quote = await this.resolveTopicAndQuote(post.ticker || post.topicQuery || post.title);
    const news = await this.fetchReliableNews(quote, post.topicQuery || post.ticker || post.title, aiCfg.finnhubApiKey);

    let addedCount = 0;
    if (news.length > 0) {
      const res = await prisma.blogNewsUpdate.createMany({
        data: news.map((n) => ({
          postId: post.id,
          headline: n.headline,
          summary: n.summary,
          sourceName: n.sourceName,
          sourceUrl: n.sourceUrl,
          sentiment: n.sentiment,
          urlHash: n.urlHash,
          publishedAt: n.publishedAt,
        })),
        skipDuplicates: true,
      });
      addedCount = res.count;
    }

    const latestNews = await prisma.blogNewsUpdate.findMany({
      where: { postId: post.id },
      orderBy: { publishedAt: 'desc' },
      take: 15,
    });

    const pkg = await this.generateEditorialPackage({
      topic: post.topicQuery || post.ticker || post.title,
      quote,
      news: latestNews.length > 0 ? (latestNews as any) : news,
      categoryOverride: post.category,
      includeMeme: Boolean(post.memeUrl),
    });

    const updatedPost = await prisma.blogPost.update({
      where: { id: post.id },
      data: {
        ...(regenerateReport
          ? {
              title: pkg.title.slice(0, 250),
              summary: pkg.summary,
              content: pkg.content,
              keyTakeaways: JSON.stringify(pkg.keyTakeaways),
            }
          : {}),
        lastPrice: quote.priceFormatted,
        priceChange: quote.changeFormatted,
        highlights: JSON.stringify(pkg.highlights),
        bannerData: JSON.stringify(pkg.banner),
        memeData: pkg.meme ? JSON.stringify(pkg.meme) : post.memeData,
        lastNewsSync: new Date(),
      },
      include: { newsUpdates: { orderBy: { publishedAt: 'desc' }, take: 20 } },
    });

    return { post: updatedPost, addedCount };
  }

  async syncAllTrackedPosts() {
    await this.ensureSchema();
    const posts = await prisma.blogPost.findMany({
      where: { autoTrackNews: true, isPublished: true, ticker: { not: null } },
      orderBy: { lastNewsSync: 'asc' },
      take: 15,
    });

    let totalAdded = 0;
    for (const p of posts) {
      try {
        const res = await this.syncPostNews(p.id, true);
        if (res) totalAdded += res.addedCount;
      } catch (err) {
        console.warn(`[AutoContent] Sync failed for ${p.slug}:`, err);
      }
    }
    return { syncedPosts: posts.length, addedStories: totalAdded };
  }

  /**
   * Render Bloomberg / TradingView Pro Institutional Hero Banner SVG (Zero text overlap)
   */
  renderBannerSvg(slug: string, bannerJson?: string | null, fallbackTitle?: string): string {
    let spec: BannerSpec = {
      kicker: 'AVORA INSTITUTIONAL RESEARCH',
      headline: fallbackTitle || 'Global Market Intelligence',
      subtitle: 'Real-Time OHLCV • Technicals & Wire Feed',
      ticker: 'MARKET',
      exchange: 'NASDAQGS',
      priceText: 'LIVE',
      changeText: '+0.00%',
      isPositive: true,
      sparkline: [100, 102, 101, 105, 104, 107, 109, 108, 112],
      dayRangeText: 'N/A',
      fiftyTwoWeekText: 'N/A',
      volumeText: 'N/A',
      rsiText: 'N/A',
      smaText: 'N/A',
      marketCapText: 'Live',
      peText: 'N/A',
      dataSource: 'Yahoo Finance v8 Real-Time Feed',
    };

    try {
      if (bannerJson) spec = { ...spec, ...JSON.parse(bannerJson) };
    } catch {}

    const accent = spec.isPositive ? '#10B981' : '#F43F5E';

    // Build SVG sparkline inside Right Terminal Chart Box (x: 645..1115, y: 245..455)
    const pts = spec.sparkline.length >= 2 ? spec.sparkline : [10, 12, 11, 14, 15];
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const span = max - min || 1;
    const coords = pts.map((v, i) => {
      const x = 650 + (i / (pts.length - 1)) * 460;
      const y = 445 - ((v - min) / span) * 190;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const linePath = `M ${coords.join(' L ')}`;
    const areaPath = `${linePath} L 1110,465 L 650,465 Z`;

    // Strictly wrap headline to 21 chars so it NEVER crosses x=585
    const headlineLines = wrapText(spec.headline, 21, 2);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050811"/>
      <stop offset="55%" stop-color="#0A1124"/>
      <stop offset="100%" stop-color="#071923"/>
    </linearGradient>
    <radialGradient id="orb" cx="80%" cy="35%" r="45%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.0"/>
    </linearGradient>
    <clipPath id="leftClip">
      <rect x="0" y="0" width="595" height="630"/>
    </clipPath>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#orb)"/>

  <!-- Terminal Grid -->
  <g stroke="#1E293B" stroke-width="1" stroke-opacity="0.4">
    <line x1="0" y1="126" x2="1200" y2="126"/>
    <line x1="0" y1="252" x2="1200" y2="252"/>
    <line x1="0" y1="378" x2="1200" y2="378"/>
    <line x1="0" y1="504" x2="1200" y2="504"/>
    <line x1="600" y1="0" x2="600" y2="630"/>
  </g>

  <!-- LEFT COLUMN (Strictly Clipped so text never overlaps right chart) -->
  <g clip-path="url(#leftClip)">
    <rect x="56" y="56" width="360" height="32" rx="16" fill="#10B981" fill-opacity="0.14" stroke="#10B981" stroke-opacity="0.4"/>
    <circle cx="76" cy="72" r="4.5" fill="#10B981"/>
    <text x="90" y="77" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="11" font-weight="800" letter-spacing="1.2" fill="#34D399">${escapeXml(spec.kicker.slice(0, 38))}</text>

    <g font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="40" font-weight="900" fill="#FFFFFF">
      ${headlineLines.map((line, i) => `<text x="56" y="${148 + i * 48}">${escapeXml(line)}</text>`).join('\n      ')}
    </g>

    <!-- Quantitative Data KPIs Box on Left -->
    <rect x="56" y="232" width="516" height="240" rx="20" fill="#0F172A" fill-opacity="0.85" stroke="#1E293B" stroke-width="1.5"/>

    <text x="80" y="268" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#64748B">INTRADAY RANGE</text>
    <text x="80" y="290" font-family="monospace" font-size="15" font-weight="800" fill="#F8FAFC">${escapeXml(spec.dayRangeText.slice(0, 26))}</text>

    <text x="320" y="268" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#64748B">SESSION VOLUME</text>
    <text x="320" y="290" font-family="monospace" font-size="15" font-weight="800" fill="#F8FAFC">${escapeXml(spec.volumeText.slice(0, 24))}</text>

    <line x1="80" y1="310" x2="548" y2="310" stroke="#1E293B" stroke-width="1"/>

    <text x="80" y="338" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#64748B">52-WEEK BAND</text>
    <text x="80" y="360" font-family="monospace" font-size="14" font-weight="800" fill="#38BDF8">${escapeXml(spec.fiftyTwoWeekText.slice(0, 30))}</text>

    <text x="320" y="338" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#64748B">RSI (14D) MOMENTUM</text>
    <text x="320" y="360" font-family="monospace" font-size="14" font-weight="800" fill="#34D399">${escapeXml(spec.rsiText.slice(0, 24))}</text>

    <line x1="80" y1="380" x2="548" y2="380" stroke="#1E293B" stroke-width="1"/>

    <text x="80" y="408" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#64748B">MOVING AVERAGES</text>
    <text x="80" y="430" font-family="monospace" font-size="13" font-weight="700" fill="#CBD5E1">${escapeXml(spec.smaText.slice(0, 42))}</text>

    <text x="80" y="456" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#64748B">DATA FEED: ${escapeXml(spec.dataSource.toUpperCase())}</text>

    <!-- Brand Footer -->
    <rect x="56" y="516" width="38" height="38" rx="10" fill="#4F46E5"/>
    <text x="75" y="542" text-anchor="middle" font-family="system-ui, sans-serif" font-size="21" font-weight="900" fill="#FFFFFF">A</text>
    <text x="108" y="534" font-family="system-ui, sans-serif" font-size="17" font-weight="800" fill="#F8FAFC">Avora Bank Institutional Research</text>
    <text x="108" y="553" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#64748B">QUANTITATIVE EQUITY &amp; MACRO DESK • ${escapeXml(slug.slice(0, 26))}</text>
  </g>

  <!-- RIGHT COLUMN: 3-MONTH PRICE CURVE & QUOTE TERMINAL -->
  <rect x="620" y="56" width="524" height="500" rx="26" fill="#0F172A" fill-opacity="0.9" stroke="#1E293B" stroke-width="2"/>

  <rect x="650" y="84" width="130" height="36" rx="10" fill="#1E293B"/>
  <text x="715" y="107" text-anchor="middle" font-family="monospace" font-size="16" font-weight="900" fill="#FFFFFF">${escapeXml(spec.ticker)}</text>
  <text x="650" y="144" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#64748B">3-MONTH DAILY CLOSE TRAJECTORY (${escapeXml(spec.exchange)})</text>

  <text x="1114" y="110" text-anchor="end" font-family="monospace" font-size="28" font-weight="900" fill="#FFFFFF">${escapeXml(spec.priceText)}</text>
  <rect x="1004" y="122" width="110" height="30" rx="8" fill="${accent}" fill-opacity="0.18"/>
  <text x="1059" y="142" text-anchor="middle" font-family="monospace" font-size="15" font-weight="900" fill="${accent}">${escapeXml(spec.changeText)} (1D)</text>

  <line x1="650" y1="172" x2="1114" y2="172" stroke="#1E293B" stroke-width="1"/>

  <!-- Price High/Low Labels -->
  <text x="1114" y="232" text-anchor="end" font-family="monospace" font-size="11" fill="#64748B">3M High: $${max.toFixed(2)}</text>
  <path d="${areaPath}" fill="url(#areaGrad)"/>
  <path d="${linePath}" fill="none" stroke="${accent}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>
  <text x="1114" y="488" text-anchor="end" font-family="monospace" font-size="11" fill="#64748B">3M Low: $${min.toFixed(2)}</text>

  <text x="650" y="528" font-family="monospace" font-size="11" font-weight="700" fill="#94A3B8">LIVE TERMINAL SNAPSHOT • AUTO-UPDATING</text>
</svg>`;
  }

  /**
   * Render Institutional Sentiment & Bull-vs-Bear Visual Infographic Card (Replaces cartoon stick figure)
   */
  renderMemeSvg(memeJson?: string | null, fallbackTicker = 'MARKET'): string {
    let spec: MemeSpec = {
      template: 'sentiment-matrix',
      topText: `${fallbackTicker} INSTITUTIONAL SENTIMENT & CATALYST MATRIX`,
      bottomText: 'Live Quantitative Support & Resistance Levels',
      ticker: fallbackTicker,
      companyName: fallbackTicker,
      priceText: 'LIVE',
      changeText: '+0.00%',
      sentimentScore: 62,
      sentimentLabel: 'BULLISH ACCUMULATION',
      bullPoints: [
        'Constructive momentum above medium-term moving averages',
        'Strong institutional liquidity and volume participation',
        'Positive catalyst coverage across primary financial wires',
      ],
      bearPoints: [
        'Overhead technical supply near 52-week high resistance',
        'Sensitivity to macro interest rate & sector rotation shifts',
        'Near-term consolidation risk after multi-week run',
      ],
      supportLevel: 'N/A',
      resistanceLevel: 'N/A',
    };

    try {
      if (memeJson) spec = { ...spec, ...JSON.parse(memeJson) };
    } catch {}

    const score = Math.min(95, Math.max(5, spec.sentimentScore || 58));
    const gaugeX = 60 + (score / 100) * 840;
    const scoreColor = score >= 60 ? '#10B981' : score <= 40 ? '#F43F5E' : '#F59E0B';

    const renderSideBullets = (items: string[], startX: number, startY: number, bulletColor: string) => {
      let y = startY;
      const out: string[] = [];
      for (const item of (items || []).slice(0, 3)) {
        const wrapped = wrapText(item, 38, 2);
        out.push(`<circle cx="${startX}" cy="${y - 5}" r="4.5" fill="${bulletColor}"/>`);
        wrapped.forEach((line, idx) => {
          out.push(
            `<text x="${startX + 16}" y="${y + idx * 20}" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="14" font-weight="600" fill="#E2E8F0">${escapeXml(line)}</text>`
          );
        });
        y += wrapped.length * 20 + 22;
      }
      return out.join('\n  ');
    };

    return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
  <defs>
    <linearGradient id="mbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#060B16"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
    <linearGradient id="meterGrad" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#F43F5E"/>
      <stop offset="50%" stop-color="#F59E0B"/>
      <stop offset="100%" stop-color="#10B981"/>
    </linearGradient>
  </defs>

  <rect width="960" height="540" rx="24" fill="url(#mbg)" stroke="#1E293B" stroke-width="2"/>

  <!-- Header Bar -->
  <text x="48" y="48" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="12" font-weight="800" letter-spacing="1.4" fill="#38BDF8">AVORA QUANTITATIVE SENTIMENT &amp; THESIS MATRIX</text>
  <text x="48" y="78" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="24" font-weight="900" fill="#FFFFFF">${escapeXml(spec.companyName)} (${escapeXml(spec.ticker)}) — ${escapeXml(spec.priceText)} (${escapeXml(spec.changeText)})</text>

  <rect x="700" y="38" width="212" height="44" rx="12" fill="${scoreColor}" fill-opacity="0.16" stroke="${scoreColor}" stroke-opacity="0.45"/>
  <text x="806" y="56" text-anchor="middle" font-family="system-ui, sans-serif" font-size="10" font-weight="800" fill="#94A3B8">COMPOSITE SIGNAL (${score}/100)</text>
  <text x="806" y="73" text-anchor="middle" font-family="monospace" font-size="12" font-weight="900" fill="${scoreColor}">${escapeXml(spec.sentimentLabel)}</text>

  <!-- Sentiment Gauge Bar -->
  <rect x="48" y="104" width="864" height="12" rx="6" fill="url(#meterGrad)" fill-opacity="0.85"/>
  <circle cx="${gaugeX.toFixed(0)}" cy="110" r="10" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
  <text x="48" y="136" font-family="monospace" font-size="10" font-weight="700" fill="#F43F5E">BEARISH (0)</text>
  <text x="480" y="136" text-anchor="middle" font-family="monospace" font-size="10" font-weight="700" fill="#F59E0B">NEUTRAL (50)</text>
  <text x="912" y="136" text-anchor="end" font-family="monospace" font-size="10" font-weight="700" fill="#10B981">BULLISH (100)</text>

  <!-- Left Box: Bullish Catalysts -->
  <rect x="48" y="156" width="418" height="284" rx="20" fill="#064E3B" fill-opacity="0.22" stroke="#10B981" stroke-opacity="0.35" stroke-width="1.5"/>
  <text x="72" y="190" font-family="system-ui, sans-serif" font-size="14" font-weight="900" letter-spacing="0.8" fill="#34D399">BULL CASE &amp; UPSIDE DRIVERS</text>
  <line x1="72" y1="204" x2="440" y2="204" stroke="#10B981" stroke-opacity="0.25"/>
  ${renderSideBullets(spec.bullPoints, 76, 236, '#10B981')}

  <!-- Right Box: Bearish / Risk Factors -->
  <rect x="494" y="156" width="418" height="284" rx="20" fill="#4C0519" fill-opacity="0.22" stroke="#F43F5E" stroke-opacity="0.35" stroke-width="1.5"/>
  <text x="518" y="190" font-family="system-ui, sans-serif" font-size="14" font-weight="900" letter-spacing="0.8" fill="#FB7185">BEAR CASE &amp; KEY RISK FACTORS</text>
  <line x1="518" y1="204" x2="886" y2="204" stroke="#F43F5E" stroke-opacity="0.25"/>
  ${renderSideBullets(spec.bearPoints, 522, 236, '#F43F5E')}

  <!-- Bottom Desk Key Levels Bar -->
  <rect x="48" y="458" width="864" height="54" rx="14" fill="#1E293B" fill-opacity="0.75" stroke="#334155"/>
  <text x="72" y="490" font-family="monospace" font-size="13" font-weight="800" fill="#F8FAFC">${escapeXml(spec.bottomText)}</text>
  <text x="890" y="490" text-anchor="end" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#94A3B8">Avora Institutional Desk</text>
</svg>`;
  }
}

export const autoContentService = new AutoContentService();
