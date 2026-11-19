import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { persistUploadedBuffer } from './storage.service';

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
  quoteTimestamp?: string;
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
  variant?: string;
  editionLabel?: string;
  chartStyle?: 'area' | 'bars' | 'dots';
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

function normalizeTitleWords(text: string): Set<string> {
  return new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

function isTitleTooSimilar(candidate: string, priorTitles: string[]): boolean {
  const cleanCandidate = candidate.trim().toLowerCase();
  if (!cleanCandidate) return true;
  const candWords = normalizeTitleWords(candidate);
  for (const prev of priorTitles) {
    const cleanPrev = String(prev || '').trim().toLowerCase();
    if (!cleanPrev) continue;
    if (cleanCandidate === cleanPrev) return true;
    const prevWords = normalizeTitleWords(prev);
    if (candWords.size === 0 || prevWords.size === 0) continue;
    let intersection = 0;
    for (const w of candWords) {
      if (prevWords.has(w)) intersection += 1;
    }
    const union = new Set([...candWords, ...prevWords]).size;
    if (union > 0 && intersection / union >= 0.72) return true;
  }
  return false;
}

function hashNewsKey(headline: string, url: string): string {
  const normalized = headline.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 72) || url;
  return crypto.createHash('sha256').update(normalized).digest('hex').slice(0, 48);
}

const DEFAULT_AUTO_PUBLISH_TOPICS = [
  'Apple Inc.',
  'NVDA',
  'Bitcoin',
  'Tesla',
  'MSFT',
  'Gold',
  'Ethereum',
  'AMZN',
];

function parseTopicsList(raw?: string | null): string[] {
  const parsed = String(raw || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : DEFAULT_AUTO_PUBLISH_TOPICS;
}

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  const suffix = `${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 5)}`;
  return `${base || 'market-brief'}-${suffix}`;
}

export class AutoContentService {
  private schemaReady = false;
  private freshnessInFlight: Promise<any> | null = null;

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
          in: [
            'ai_openai_api_key',
            'ai_gemini_api_key',
            'ai_finnhub_api_key',
            'ai_alphavantage_api_key',
            'ai_auto_publish_enabled',
            'ai_auto_publish_interval_hours',
            'ai_auto_publish_topics',
            'ai_last_auto_publish_at',
          ],
        },
      },
    });
    const map: Record<string, string> = {};
    for (const k of keys) map[k.key] = k.value;

    const rawInterval = Number(map.ai_auto_publish_interval_hours || '6');
    const autoPublishIntervalHours = Number.isFinite(rawInterval)
      ? Math.max(1, Math.min(72, Math.round(rawInterval)))
      : 6;

    return {
      openaiApiKey: (map.ai_openai_api_key || process.env.OPENAI_API_KEY || '').trim(),
      geminiApiKey: (map.ai_gemini_api_key || process.env.GEMINI_API_KEY || '').trim(),
      finnhubApiKey: (map.ai_finnhub_api_key || process.env.FINNHUB_API_KEY || '').trim(),
      alphaVantageApiKey: (map.ai_alphavantage_api_key || process.env.ALPHAVANTAGE_API_KEY || '').trim(),
      autoPublishEnabled: map.ai_auto_publish_enabled !== 'false',
      autoPublishIntervalHours,
      autoPublishTopics: parseTopicsList(map.ai_auto_publish_topics).join(', '),
      lastAutoPublishAt: map.ai_last_auto_publish_at || null,
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
      openaiKeyMask: this.maskSecretKey(cfg.openaiApiKey),
      geminiKeyMask: this.maskSecretKey(cfg.geminiApiKey),
      finnhubKeyMask: this.maskSecretKey(cfg.finnhubApiKey),
      alphaVantageKeyMask: this.maskSecretKey(cfg.alphaVantageApiKey),
      autoPublishEnabled: cfg.autoPublishEnabled,
      autoPublishIntervalHours: cfg.autoPublishIntervalHours,
      autoPublishTopics: cfg.autoPublishTopics,
      lastAutoPublishAt: cfg.lastAutoPublishAt,
      engineMode: providers.join(' + '),
    };
  }

  private maskSecretKey(raw?: string | null): string | null {
    const k = String(raw || '').trim();
    if (!k) return null;
    if (k.length <= 8) return `${k.slice(0, 2)}••••${k.slice(-2)}`;
    return `${k.slice(0, 5)}••••••${k.slice(-4)}`;
  }

  private sanitizeApiKeyInput(raw?: string): string {
    return String(raw || '')
      .trim()
      .replace(/^["']|["']$/g, '')
      .trim();
  }

  async saveAiConfig(data: {
    openaiApiKey?: string;
    geminiApiKey?: string;
    finnhubApiKey?: string;
    alphaVantageApiKey?: string;
    clearOpenaiKey?: boolean;
    clearGeminiKey?: boolean;
    clearFinnhubKey?: boolean;
    clearAlphaVantageKey?: boolean;
    autoPublishEnabled?: boolean;
    autoPublishIntervalHours?: number;
    autoPublishTopics?: string;
  }) {
    const updates: Array<{ key: string; value: string }> = [];
    if (data.clearOpenaiKey) {
      updates.push({ key: 'ai_openai_api_key', value: '' });
    } else if (typeof data.openaiApiKey === 'string' && this.sanitizeApiKeyInput(data.openaiApiKey)) {
      updates.push({ key: 'ai_openai_api_key', value: this.sanitizeApiKeyInput(data.openaiApiKey) });
    }
    if (data.clearGeminiKey) {
      updates.push({ key: 'ai_gemini_api_key', value: '' });
    } else if (typeof data.geminiApiKey === 'string' && this.sanitizeApiKeyInput(data.geminiApiKey)) {
      updates.push({ key: 'ai_gemini_api_key', value: this.sanitizeApiKeyInput(data.geminiApiKey) });
    }
    if (data.clearFinnhubKey) {
      updates.push({ key: 'ai_finnhub_api_key', value: '' });
    } else if (typeof data.finnhubApiKey === 'string' && this.sanitizeApiKeyInput(data.finnhubApiKey)) {
      updates.push({ key: 'ai_finnhub_api_key', value: this.sanitizeApiKeyInput(data.finnhubApiKey) });
    }
    if (data.clearAlphaVantageKey) {
      updates.push({ key: 'ai_alphavantage_api_key', value: '' });
    } else if (typeof data.alphaVantageApiKey === 'string' && this.sanitizeApiKeyInput(data.alphaVantageApiKey)) {
      updates.push({ key: 'ai_alphavantage_api_key', value: this.sanitizeApiKeyInput(data.alphaVantageApiKey) });
    }
    if (typeof data.autoPublishEnabled === 'boolean') {
      updates.push({ key: 'ai_auto_publish_enabled', value: data.autoPublishEnabled ? 'true' : 'false' });
    }
    if (data.autoPublishIntervalHours !== undefined) {
      const hrs = Math.max(1, Math.min(72, Math.round(Number(data.autoPublishIntervalHours) || 6)));
      updates.push({ key: 'ai_auto_publish_interval_hours', value: String(hrs) });
    }
    if (typeof data.autoPublishTopics === 'string' && data.autoPublishTopics.trim()) {
      updates.push({
        key: 'ai_auto_publish_topics',
        value: parseTopicsList(data.autoPublishTopics).join(', '),
      });
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
    const cacheBust = Date.now();

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
          `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(cleaned)}&quotesCount=3&newsCount=0&_ts=${cacheBust}`,
          { headers: { 'User-Agent': USER_AGENT, 'Cache-Control': 'no-cache, no-store' }, signal: AbortSignal.timeout(4500) }
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
    let quoteTimestamp = new Date().toISOString();
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
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=3mo&_ts=${cacheBust}`,
        { headers: { 'User-Agent': USER_AGENT, 'Cache-Control': 'no-cache, no-store' }, signal: AbortSignal.timeout(5500) }
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
          if (typeof meta.regularMarketTime === 'number' && meta.regularMarketTime > 0) {
            quoteTimestamp = new Date(meta.regularMarketTime * 1000).toISOString();
          }
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
      quoteTimestamp,
      technicals,
      fundamentals,
    };
  }

  /**
   * Gather verified market news from Finnhub API, Alpha Vantage News API, Yahoo Finance RSS, and Google News RSS.
   * Prioritizes breaking <24h/48h stories and ranks headlines not already featured ahead of repeated wire stories.
   */
  async fetchReliableNews(
    quote: MarketQuote,
    originalTopic: string,
    finnhubKey?: string,
    excludeHeadlineKeys?: Set<string>
  ): Promise<RawNewsItem[]> {
    const aiCfg = await this.getAiConfig();
    const activeFinnhub = finnhubKey || aiCfg.finnhubApiKey;
    const items: RawNewsItem[] = [];
    const cacheBust = Date.now();
    const queryTerm =
      quote.companyName && quote.companyName !== quote.symbol
        ? `${quote.companyName} ${quote.symbol}`
        : originalTopic;

    const parseAlphaVantageTime = (raw?: string): Date => {
      if (!raw || typeof raw !== 'string') return new Date();
      // Format: YYYYMMDDTHHMMSS
      const m = raw.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/);
      if (!m) return new Date();
      const d = new Date(`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`);
      return Number.isNaN(d.getTime()) ? new Date() : d;
    };

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
      // Pull breaking last-24h stories first, plus 7d fallback pool
      fetch(
        `https://news.google.com/rss/search?q=${encodeURIComponent(`${queryTerm} when:1d`)}&hl=en-US&gl=US&ceid=US:en&_ts=${cacheBust}`,
        { headers: { 'User-Agent': USER_AGENT, 'Cache-Control': 'no-cache, no-store' }, signal: AbortSignal.timeout(5500) }
      )
        .then(async (r) => {
          if (r.ok) parseRss(await r.text(), 'Google News');
        })
        .catch(() => {}),

      fetch(
        `https://news.google.com/rss/search?q=${encodeURIComponent(`${queryTerm} when:7d`)}&hl=en-US&gl=US&ceid=US:en&_ts=${cacheBust}`,
        { headers: { 'User-Agent': USER_AGENT, 'Cache-Control': 'no-cache, no-store' }, signal: AbortSignal.timeout(5500) }
      )
        .then(async (r) => {
          if (r.ok) parseRss(await r.text(), 'Google News');
        })
        .catch(() => {}),

      fetch(
        `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(quote.isCrypto ? `${quote.symbol}-USD` : quote.symbol)}&region=US&lang=en-US&_ts=${cacheBust}`,
        { headers: { 'User-Agent': USER_AGENT, 'Cache-Control': 'no-cache, no-store' }, signal: AbortSignal.timeout(5500) }
      )
        .then(async (r) => {
          if (r.ok) parseRss(await r.text(), 'Yahoo Finance');
        })
        .catch(() => {}),
    ];

    if (activeFinnhub && !quote.isCrypto) {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 4 * 86400000).toISOString().slice(0, 10);
      tasks.push(
        fetch(
          `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(quote.symbol)}&from=${from}&to=${to}&token=${encodeURIComponent(activeFinnhub)}`,
          { headers: { 'Cache-Control': 'no-cache, no-store' }, signal: AbortSignal.timeout(5000) }
        )
          .then(async (r) => {
            if (!r.ok) return;
            const arr: any = await r.json();
            if (Array.isArray(arr)) {
              for (const n of arr.slice(0, 15)) {
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
          `https://www.alphavantage.co/query?function=NEWS_SENTIMENT&tickers=${encodeURIComponent(quote.symbol)}&sort=LATEST&limit=15&apikey=${encodeURIComponent(aiCfg.alphaVantageApiKey)}`,
          { headers: { 'Cache-Control': 'no-cache, no-store' }, signal: AbortSignal.timeout(5000) }
        )
          .then(async (r) => {
            if (!r.ok) return;
            const j: any = await r.json();
            if (Array.isArray(j?.feed)) {
              for (const f of j.feed.slice(0, 15)) {
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
                  publishedAt: parseAlphaVantageTime(f.time_published),
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

    if (excludeHeadlineKeys && excludeHeadlineKeys.size > 0) {
      const freshUnseen = deduped.filter((item) => !excludeHeadlineKeys.has(item.urlHash));
      const previouslyUsed = deduped.filter((item) => excludeHeadlineKeys.has(item.urlHash));
      return [...freshUnseen, ...previouslyUsed].slice(0, 18);
    }

    return deduped.slice(0, 18);
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
    priorTitles?: string[];
    priorSummaries?: string[];
    usedHeadlineKeys?: Set<string>;
    editionNumber?: number;
    visualVariant?: string;
    forceFreshHeading?: boolean;
  }) {
    const {
      topic,
      quote,
      news,
      categoryOverride,
      includeMeme = true,
      priorTitles = [],
      priorSummaries = [],
      usedHeadlineKeys,
      editionNumber = 1,
      visualVariant,
    } = opts;
    const aiCfg = await this.getAiConfig();
    const t = quote.technicals;
    const f = quote.fundamentals;
    const now = new Date();
    const nowUtc = `${now.toISOString().replace('T', ' ').slice(0, 16)} UTC`;

    const EDITORIAL_ANGLES = [
      {
        name: 'Valuation, Multiples & Market Positioning',
        instruction: 'Lead with valuation ratios, market cap scale, earnings efficiency, and institutional accumulation levels.',
        titleSuffix: 'Valuation Multiples & Institutional Positioning Update',
        headlineTag: 'VALUATION BRIEF',
      },
      {
        name: 'Technical Momentum, Moving Averages & Breakout Structure',
        instruction: 'Lead with RSI-14 momentum, SMA-20 vs SMA-50 trend alignment, intraday volatility bands, and breakout triggers.',
        titleSuffix: 'Technical Momentum & Moving-Average Setup',
        headlineTag: 'TECHNICALS & FLOW',
      },
      {
        name: 'Breaking Catalysts & Institutional News Sentiment',
        instruction: 'Lead with breaking media wires from the last 24-48h, headline sentiment divergence, and near-term fundamental catalysts.',
        titleSuffix: 'Catalyst Wire & Sentiment Shift Dispatch',
        headlineTag: 'CATALYST DISPATCH',
      },
      {
        name: '52-Week Range Architecture & Liquidity Depth',
        instruction: 'Lead with 52-week percentile positioning, session liquidity vs 20-day average volume, and support/resistance shelves.',
        titleSuffix: '52-Week Range & Liquidity Depth Note',
        headlineTag: 'RANGE & LIQUIDITY',
      },
      {
        name: 'Institutional Bull vs. Bear Risk Matrix',
        instruction: 'Lead with a balanced asymmetric risk-reward thesis contrasting upside triggers against macro and sector headwinds.',
        titleSuffix: 'Asymmetric Bull/Bear Risk Assessment',
        headlineTag: 'RISK MATRIX',
      },
      {
        name: 'Strategic Outlook & Cross-Asset Capital Flows',
        instruction: 'Lead with 3-month return trajectory, consensus targets, and medium-term portfolio allocation context.',
        titleSuffix: '3-Month Trajectory & Allocation Outlook',
        headlineTag: 'STRATEGIC OUTLOOK',
      },
      {
        name: 'Institutional Earnings & Analyst Target Convergence',
        instruction: 'Lead with Wall Street consensus positioning, diluted EPS trajectory, and dispersion around analyst price targets.',
        titleSuffix: 'Analyst Target Convergence & Consensus Pulse',
        headlineTag: 'CONSENSUS PULSE',
      },
      {
        name: 'Intraday Volatility Band & Order-Book Liquidity Surge',
        instruction: 'Lead with intraday high-low spread compression, relative session volume vs 20-day baseline, and tactical execution zones.',
        titleSuffix: 'Session Liquidity & Intraday Spread Dispatch',
        headlineTag: 'LIQUIDITY & SPREAD',
      },
      {
        name: 'Macro Sensitivity & Cross-Market Regime Positioning',
        instruction: 'Lead with beta risk sensitivity, global yield regime effects, and institutional hedging demand.',
        titleSuffix: 'Macro Regime & Cross-Asset Sensitivity Brief',
        headlineTag: 'MACRO REGIME',
      },
      {
        name: 'Trend Reversal Thresholds & Smart-Money Accumulation Watch',
        instruction: 'Lead with key moving-average crossover triggers, institutional accumulation shelves, and upside confirmation levels.',
        titleSuffix: 'Accumulation Shelves & Breakout Thresholds',
        headlineTag: 'ACCUMULATION WATCH',
      },
    ];

    const BANNER_VARIANTS = [
      'emerald-grid',
      'cobalt-terminal',
      'amber-bullion',
      'violet-quant',
      'cyan-horizon',
      'crimson-brief',
    ];
    const CHART_STYLES: Array<'area' | 'bars' | 'dots'> = ['area', 'bars', 'dots'];

    const recentTitleBlob = priorTitles.slice(0, 3).join(' ').toLowerCase();
    let angleIndex = (Math.max(1, editionNumber) - 1) % EDITORIAL_ANGLES.length;
    for (let step = 0; step < EDITORIAL_ANGLES.length; step++) {
      const candIdx = (Math.max(1, editionNumber) - 1 + step) % EDITORIAL_ANGLES.length;
      const candTag = EDITORIAL_ANGLES[candIdx].headlineTag.toLowerCase();
      const candKeyWords = EDITORIAL_ANGLES[candIdx].titleSuffix
        .toLowerCase()
        .split(/\s+/)
        .filter((w) => w.length > 4)
        .slice(0, 2);
      const collides =
        recentTitleBlob.includes(candTag) ||
        (candKeyWords.length > 0 && candKeyWords.every((kw) => recentTitleBlob.includes(kw)));
      if (!collides) {
        angleIndex = candIdx;
        break;
      }
    }
    const angle = EDITORIAL_ANGLES[angleIndex];
    const chosenVariant =
      visualVariant && BANNER_VARIANTS.includes(visualVariant)
        ? visualVariant
        : BANNER_VARIANTS[(Math.max(1, editionNumber) - 1) % BANNER_VARIANTS.length];
    const chosenChartStyle = CHART_STYLES[(Math.max(1, editionNumber) - 1) % CHART_STYLES.length];
    const editionLabel = `DISPATCH #${editionNumber} • ${angle.headlineTag}`;

    // Prioritize breaking unseen news headlines first so repeated dispatches highlight fresh stories
    let orderedNews = news;
    if (usedHeadlineKeys && usedHeadlineKeys.size > 0) {
      const unseen = news.filter((n) => !usedHeadlineKeys.has(hashNewsKey(n.headline, n.sourceUrl)));
      const seen = news.filter((n) => usedHeadlineKeys.has(hashNewsKey(n.headline, n.sourceUrl)));
      orderedNews = [...unseen, ...seen];
    }
    const rotatedNews =
      orderedNews.length > 1 && (!usedHeadlineKeys || usedHeadlineKeys.size === 0)
        ? [
            ...orderedNews.slice((editionNumber - 1) % orderedNews.length),
            ...orderedNews.slice(0, (editionNumber - 1) % orderedNews.length),
          ]
        : orderedNews;

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
      `Latest Feed Timestamp: ${quote.quoteTimestamp || nowUtc}`,
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

    const newsContext = rotatedNews
      .slice(0, 8)
      .map((n, i) => {
        const ageHrs = Math.max(0, Math.round((now.getTime() - new Date(n.publishedAt).getTime()) / 3600000));
        return `${i + 1}. [${n.sourceName} | ${n.sentiment} | ${ageHrs}h ago] "${n.headline}" — ${n.summary.slice(0, 220)}`;
      })
      .join('\n');

    const avoidanceBlockParts: string[] = [];
    if (priorTitles.length > 0) {
      avoidanceBlockParts.push(
        `PREVIOUSLY PUBLISHED HEADLINES (STRICTLY DO NOT REPEAT OR CLOSELY PARAPHRASE):\n${priorTitles
          .slice(0, 14)
          .map((pt, idx) => `- (${idx + 1}) ${pt}`)
          .join('\n')}`
      );
    }
    if (priorSummaries.length > 0) {
      avoidanceBlockParts.push(
        `RECENT SUMMARY ANGLES ALREADY COVERED (WRITE A COMPLETELY DIFFERENT OPENING & INSIGHT):\n${priorSummaries
          .slice(0, 6)
          .map((ps, idx) => `- (${idx + 1}) ${ps.slice(0, 180)}`)
          .join('\n')}`
      );
    }
    const avoidanceBlock = avoidanceBlockParts.length > 0 ? `\n\n${avoidanceBlockParts.join('\n\n')}` : '';

    const systemPrompt = `You are a Managing Director of Equity & Digital Asset Research at Avora Bank.
Write a COMPLETELY FRESH, LATEST, NEVER-BEFORE-SEEN announcement & institutional research note (Edition #${editionNumber}, Timestamp: ${nowUtc}) grounded 100% in the real-time quantitative metrics and latest breaking wire stories provided.
MANDATORY EDITORIAL LENS FOR THIS EDITION: "${angle.name}" — ${angle.instruction}
FRESHNESS RULES:
1. Prioritize the newest (<24h-48h) news headlines and latest live market levels first.
2. Never reuse boilerplate phrasing, identical section titles, recycled summaries, or repeated headlines from previous announcements.
3. Explicitly reflect today's date/session context naturally without sounding robotic.
Return ONLY valid JSON matching this schema:
{
  "title": "Distinct, breaking announcement headline citing ${quote.symbol} and ${angle.name} (max 95 chars, completely new vs prior titles)",
  "summary": "2-sentence unique executive announcement with exact live price, fresh lens insight, and latest wire catalyst",
  "category": "Equities & Markets | Digital Assets | Macro & Commodities",
  "tags": ["Tag1", "Tag2", "Tag3", "Tag4", "Tag5"],
  "keyTakeaways": ["4-5 original data-rich bullet takeaways tailored to this edition's angle"],
  "contentParagraphs": [
    "## 1. Fresh Angle Heading\\nDetailed original paragraph focused on the selected editorial lens with real numbers.",
    "## 2. Wire & Catalyst Synthesis\\nDetailed synthesis of the latest news stories, naming sources and fresh takeaways.",
    "## 3. Quantitative & Technical Deep Dive\\nQuantitative breakdown of RSI-14, SMA-20/50, volume, and support/resistance zones.",
    "## 4. Strategic Desk Outlook & Risk Notes\\nBalanced institutional outlook and specific upside/downside risk triggers."
  ],
  "todayHighlights": [{"text": "Crisp 1-2 sentence factual highlight with latest numbers/events", "source": "Exact source name"}],
  "bullPoints": ["3 concrete data-backed bullish drivers (max 65 chars each)"],
  "bearPoints": ["3 concrete data-backed risk/bearish factors (max 65 chars each)"],
  "deskTakeaway": "Sharp 1-line institutional trading desk verdict (max 75 chars)"
}`;

    const userPrompt = `EDITION NONCE: ${editionNumber}-${Date.now().toString(36)}\nGENERATED AT: ${nowUtc}\nTOPIC: ${topic}\n\nREAL-TIME QUANTITATIVE DATA:\n${metricsSummary}\n\nLATEST VERIFIED NEWS WIRES (NEWEST & UNUSED FIRST):\n${newsContext || 'No breaking wire stories in the last 24h.'}${avoidanceBlock}`;

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
            temperature: 0.78,
            top_p: 0.92,
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
              generationConfig: { responseMimeType: 'application/json', temperature: 0.78, topP: 0.92 },
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

    const bullCount = rotatedNews.filter((n) => n.sentiment === 'BULLISH').length;
    const bearCount = rotatedNews.filter((n) => n.sentiment === 'BEARISH').length;
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

    const topNews1 = rotatedNews[0];
    const topNews2 = rotatedNews[1];
    const topNews3 = rotatedNews[2];
    const dateStamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const vsSmaText =
      t.sma20 && quote.price
        ? quote.price >= t.sma20
          ? `${(((quote.price - t.sma20) / t.sma20) * 100).toFixed(2)}% above its 20-day moving average`
          : `${(((t.sma20 - quote.price) / t.sma20) * 100).toFixed(2)}% below its 20-day moving average`
        : 'tracking near medium-term equilibrium';

    const fallbackParagraphSets: string[][] = [
      [
        `## 1. Valuation Snapshot & Capitalization Scale (${dateStamp})\n${quote.companyName} (${quote.symbol}) trades on ${quote.exchange} at ${quote.priceFormatted} (${quote.changeFormatted} session move${quote.prevClose ? ` from $${quote.prevClose.toFixed(2)} prior close` : ''}).${f.marketCap ? ` Implied equity value stands near ${f.marketCap}` : ''}${f.peRatio ? ` with a trailing P/E multiple of ${f.peRatio}` : ''}${f.eps ? ` on ${f.eps} diluted EPS` : ''}. Intraday turnover spans ${dayRangeStr} on ${volStr} volume.`,
        `## 2. Primary Catalyst & Media Wire Signals\n${topNews1 ? `Attention on ${quote.symbol} centers around ${topNews1.sourceName}'s report: "${topNews1.headline}" — ${topNews1.summary.slice(0, 210)}.${topNews2 ? ` ${topNews2.sourceName} separately flags: "${topNews2.headline}".` : ''}` : `Institutional coverage on ${quote.symbol} remains focused on core earnings cadence and capital discipline.`}`,
        `## 3. Trend Moving Averages & RSI Context\nWith 14-day RSI at ${rsiStr}, ${quote.symbol} sits ${vsSmaText} (${smaStr}). Immediate structural demand rests near $${supportNum.toFixed(2)}, while upper supply caps near $${resistNum.toFixed(2)}.`,
        `## 4. Portfolio Risk & Positioning Matrix\n${f.analystConsensus ? `Analyst tracking stands at ${f.analystConsensus}${f.analystTarget ? ` (mean target ${f.analystTarget})` : ''}. ` : ''}Sustained closes above $${resistNum.toFixed(2)} expand upside breadth, whereas breaks under $${supportNum.toFixed(2)} warrant tighter exposure control.`,
      ],
      [
        `## 1. Momentum Architecture & Intraday Action\nTechnical desk monitoring on ${quote.companyName} (${quote.symbol}) records spot pricing at ${quote.priceFormatted} (${quote.changeFormatted}), carving a session corridor of ${dayRangeStr}. Over the trailing quarter, price performance registers ${t.return3mPct !== null ? `${t.return3mPct >= 0 ? '+' : ''}${t.return3mPct}%` : quote.changeFormatted}.`,
        `## 2. Oscillator Readings & Trend Alignment\nMomentum stands at RSI-14 = ${rsiStr}, with ${quote.symbol} currently ${vsSmaText}. Benchmark trend lines indicate ${smaStr}, placing tactical defense at $${supportNum.toFixed(2)} and breakout confirmation above $${resistNum.toFixed(2)}.`,
        `## 3. Volume Participation & News Tape\nSession liquidity reached ${volStr}. Wire monitoring tracks ${rotatedNews.length} stories (${bullCount} bullish vs ${bearCount} bearish), led by ${topNews1 ? `${topNews1.sourceName}: "${topNews1.headline}"` : 'steady institutional commentary'}.`,
        `## 4. Execution Takeaways for Trading Desks\nMomentum desks monitor whether volume exceeds the 20-day baseline (${formatCompactNumber(t.avgVolume20d)}) on strength toward $${resistNum.toFixed(2)}, while respecting macro rate sensitivity across ${quote.exchange}.`,
      ],
      [
        `## 1. Headline Catalyst Dispatch: ${quote.symbol} (${dateStamp})\n${topNews1 ? `Fresh wire coverage from ${topNews1.sourceName} highlights "${topNews1.headline}" as ${quote.companyName} (${quote.symbol}) prints ${quote.priceFormatted} (${quote.changeFormatted}).` : `${quote.companyName} (${quote.symbol}) holds ${quote.priceFormatted} (${quote.changeFormatted}) on ${quote.exchange}.`}${topNews2 ? ` Follow-on reporting by ${topNews2.sourceName} adds focus on "${topNews2.headline}".` : ''}`,
        `## 2. Sentiment Balance Across Institutional Feeds\nAcross ${rotatedNews.length} verified financial feeds monitored in this dispatch, ${bullCount} register constructive catalysts, ${bearCount} flag downside risks, and ${Math.max(0, rotatedNews.length - bullCount - bearCount)} remain neutral — producing a composite score of ${rawSentScore}/100 (${sentimentLabel}).`,
        `## 3. Market Depth & 52-Week Standing\nTrading at ${t.fiftyTwoWeekPct ?? 50}% of its 52-week band (${w52Str}), ${quote.symbol} exhibits intraday amplitude between ${dayRangeStr} alongside ${volStr} volume.`,
        `## 4. Catalyst Watchlist & Key Levels\nKey inflection levels track support at $${supportNum.toFixed(2)} and resistance near $${resistNum.toFixed(2)}, alongside upcoming fundamental updates${f.analystTarget ? ` toward street consensus ${f.analystTarget}` : ''}.`,
      ],
      [
        `## 1. 52-Week Range Architecture & Liquidity Map\nPositioned at the ${t.fiftyTwoWeekPct ?? 50}th percentile of its 52-week range (${w52Str}), ${quote.companyName} (${quote.symbol}) quotes at ${quote.priceFormatted} (${quote.changeFormatted}) during active ${quote.exchange} trading.`,
        `## 2. Depth & Volume Concentration Analysis\nLiquidity conditions show ${volStr} traded in the current window, supporting tight execution spreads across institutional order books${f.marketCap ? ` backed by ${f.marketCap} capitalization` : ''}.`,
        `## 3. News Catalysts & Macro Framing\n${topNews1 ? `${topNews1.sourceName} notes "${topNews1.headline}". ` : ''}${topNews3 ? `Meanwhile, ${topNews3.sourceName} examines "${topNews3.headline}".` : `Trend references hold at ${smaStr}.`}`,
        `## 4. Technical Cushion & Overhead Supply\nBuyers defend the $${supportNum.toFixed(2)} shelf (${vsSmaText}), while overhead supply clusters toward $${resistNum.toFixed(2)} with RSI-14 reading ${rsiStr}.`,
      ],
      [
        `## 1. Asymmetric Bull vs. Bear Review — ${quote.symbol}\nAt ${quote.priceFormatted} (${quote.changeFormatted}), ${quote.companyName} presents a clear bifurcation between trend continuation catalysts and valuation/macro risk controls across ${dayRangeStr}.`,
        `## 2. Upside Thesis Drivers\nPositive trajectory (${t.return3mPct !== null ? `${t.return3mPct >= 0 ? '+' : ''}${t.return3mPct}% 3M` : quote.changeFormatted}) and ${smaStr} alignment anchor institutional bids.${topNews1 ? ` Supportive coverage via ${topNews1.sourceName} ("${topNews1.headline.slice(0, 140)}") reinforces market engagement.` : ''}`,
        `## 3. Risk Factors & Downside Scenarios\nKey vulnerabilities include potential supply rejection near $${resistNum.toFixed(2)}, broader rate-expectation shifts, and headline volatility${topNews2 ? ` underscored by ${topNews2.sourceName} ("${topNews2.headline.slice(0, 110)}")` : ''}.`,
        `## 4. Desk Risk Parameters\nTraders weigh ${rsiStr} momentum against structural support at $${supportNum.toFixed(2)} and street consensus${f.analystConsensus ? ` (${f.analystConsensus})` : ''} before expanding position sizing.`,
      ],
      [
        `## 1. Three-Month Trajectory & Strategic Outlook\nOver the past 90 trading days, ${quote.companyName} (${quote.symbol}) has registered ${t.return3mPct !== null ? `${t.return3mPct >= 0 ? '+' : ''}${t.return3mPct}%` : quote.changeFormatted}, settling most recently at ${quote.priceFormatted} on ${quote.exchange}.`,
        `## 2. Multi-Feed Institutional Briefing\n${topNews1 ? `Lead wire insights from ${topNews1.sourceName} highlight "${topNews1.headline}". ` : ''}${topNews2 ? `Additional context from ${topNews2.sourceName} covers "${topNews2.headline}".` : ''}`,
        `## 3. Quantitative Health Check\nTechnicals show RSI(14) = ${rsiStr}, ${smaStr}, and volume at ${volStr}, situating ${quote.symbol} at ${t.fiftyTwoWeekPct ?? 50}% of its 52-week band.`,
        `## 4. Medium-Term Levels & Summary Verdict\nConstructive structure persists above $${supportNum.toFixed(2)} with upside checkpoint at $${resistNum.toFixed(2)}${f.analystTarget ? ` and mean street target near ${f.analystTarget}` : ''}.`,
      ],
      [
        `## 1. Analyst Consensus & Target Convergence (${dateStamp})\nStreet positioning on ${quote.companyName} (${quote.symbol}) centers around ${f.analystConsensus || 'balanced institutional ratings'}${f.analystTarget ? ` with a consensus target near ${f.analystTarget}` : ''}, as spot trading prints ${quote.priceFormatted} (${quote.changeFormatted}).`,
        `## 2. Earnings Efficiency & Wire Coverage\n${f.peRatio ? `Valuation checks track a ${f.peRatio} multiple${f.eps ? ` alongside ${f.eps} EPS` : ''}. ` : ''}${topNews1 ? `${topNews1.sourceName} highlights: "${topNews1.headline}".` : `Real-time desk monitoring captures ongoing sector repricing.`}`,
        `## 3. Moving Average Dispersion\nPrice action remains ${vsSmaText} with ${smaStr} and RSI-14 measuring ${rsiStr}, keeping medium-term risk anchored near $${supportNum.toFixed(2)}.`,
        `## 4. Forward Conviction Levels\nClosing stability above $${resistNum.toFixed(2)} reinforces institutional upside revisions while maintaining downside defense along $${supportNum.toFixed(2)}.`,
      ],
      [
        `## 1. Session Liquidity & Intraday Spread Monitor (${dateStamp})\nActive ${quote.exchange} tape for ${quote.companyName} (${quote.symbol}) spans ${dayRangeStr} with ${volStr} volume changing hands at ${quote.priceFormatted} (${quote.changeFormatted}).`,
        `## 2. Microstructure & Breaking Wire Drivers\n${topNews1 ? `Order-flow catalysts follow ${topNews1.sourceName}: "${topNews1.headline}". ` : ''}${topNews2 ? `Secondary headline pulse via ${topNews2.sourceName} notes "${topNews2.headline}".` : ''}`,
        `## 3. Volatility & 52-Week Percentile Standing\nSituated at ${t.fiftyTwoWeekPct ?? 50}% of its 52-week envelope (${w52Str}), ${quote.symbol} carries a quantitative sentiment score of ${rawSentScore}/100 (${sentimentLabel}).`,
        `## 4. Institutional Execution Thresholds\nLiquidity providers cluster bids near $${supportNum.toFixed(2)} and monitor breakouts above $${resistNum.toFixed(2)} backed by sustained turnover.`,
      ],
      [
        `## 1. Macro Regime & Cross-Asset Positioning (${dateStamp})\nAcross broader ${quote.exchange} risk regimes, ${quote.companyName} (${quote.symbol}) trades at ${quote.priceFormatted} (${quote.changeFormatted})${f.beta ? ` carrying a ${f.beta} historical beta` : ''}.`,
        `## 2. External Policy & Media Tape Signals\n${topNews1 ? `Macro and sector reporting via ${topNews1.sourceName} centers on "${topNews1.headline}". ` : ''}${topNews3 ? `Further analysis from ${topNews3.sourceName} explores "${topNews3.headline}".` : ''}`,
        `## 3. Quantitative Trend Benchmarking\nAgainst 20-day and 50-day trend references (${smaStr}), RSI(14) registers ${rsiStr} over a ${dayRangeStr} intraday corridor.`,
        `## 4. Institutional Allocation Strategy\nCross-asset desks align sizing around $${supportNum.toFixed(2)} floor support and $${resistNum.toFixed(2)} resistance ahead of upcoming macro prints.`,
      ],
      [
        `## 1. Accumulation Shelves & Breakout Triggers (${dateStamp})\nDesk telemetry for ${quote.companyName} (${quote.symbol}) maps institutional support around $${supportNum.toFixed(2)} versus upper supply at $${resistNum.toFixed(2)}, with spot quoting ${quote.priceFormatted} (${quote.changeFormatted}).`,
        `## 2. Fresh News Catalyst Integration\n${topNews1 ? `Latest headlines led by ${topNews1.sourceName} examine "${topNews1.headline}". ` : ''}${topNews2 ? `${topNews2.sourceName} adds "${topNews2.headline}".` : ''}`,
        `## 3. Momentum & Participation Confirmation\nWith ${volStr} volume and ${t.return3mPct !== null ? `${t.return3mPct >= 0 ? '+' : ''}${t.return3mPct}% 3-month return` : 'steady quarterly cadence'}, ${quote.symbol} sits ${vsSmaText}.`,
        `## 4. Tactical Breakout Verdict\nComposite desk posture stands at ${sentimentLabel} (${rawSentScore}/100), awaiting volume-backed confirmation past $${resistNum.toFixed(2)}.`,
      ],
    ];

    const fallbackTitles = [
      `${quote.companyName} (${quote.symbol}) at ${quote.priceFormatted}: ${angle.titleSuffix}`,
      `${quote.symbol} Technical Briefing (${dateStamp}): ${quote.priceFormatted} (${quote.changeFormatted}) & Trend Structure`,
      topNews1
        ? `${quote.symbol} Breaking Wire: ${topNews1.headline.slice(0, 62)}`
        : `${quote.companyName} (${quote.symbol}) Institutional News & Wire Brief (#${editionNumber})`,
      `${quote.symbol} at ${t.fiftyTwoWeekPct ?? 50}% of 52-Week Range — Liquidity & Depth Report`,
      `${quote.companyName} (${quote.symbol}) Bull vs. Bear Risk Matrix at ${quote.priceFormatted}`,
      `${quote.symbol} 3-Month Allocation Outlook (${dateStamp}): ${quote.changeFormatted} Move & Key Levels`,
      `${quote.symbol} Analyst Consensus & Valuation Check (${dateStamp}): ${quote.priceFormatted}`,
      `${quote.symbol} Session Liquidity & Volatility Dispatch: ${dayRangeStr} Band`,
      `${quote.companyName} (${quote.symbol}) Macro Regime Note — ${quote.changeFormatted} Session Update`,
      `${quote.symbol} Accumulation Watch (${dateStamp}): Support $${supportNum.toFixed(0)} vs $${resistNum.toFixed(0)}`,
    ];

    const fallbackSummaries = [
      `Valuation-focused edition (#${editionNumber}) for ${quote.companyName} (${quote.symbol}) at ${quote.priceFormatted} (${quote.changeFormatted}), examining ${f.marketCap ? `${f.marketCap} market scale` : 'capitalization'}, ${f.peRatio || 'multiples'}, and wire catalysts.`,
      `Technical momentum note (#${editionNumber}) tracking ${quote.symbol} at ${quote.priceFormatted} with RSI-14 at ${t.rsi14 ?? 'N/A'}, ${vsSmaText}, and session range ${dayRangeStr}.`,
      `Catalyst briefing (#${editionNumber}) aggregating ${rotatedNews.length} financial wires on ${quote.symbol} (${bullCount} bullish / ${bearCount} bearish) led by ${topNews1?.sourceName || 'Market Wires'} at ${quote.priceFormatted}.`,
      `Range & liquidity structure review (#${editionNumber}) placing ${quote.symbol} at the ${t.fiftyTwoWeekPct ?? 50}th percentile of its 52W corridor (${w52Str}) on ${formatCompactNumber(t.volume)} volume.`,
      `Risk-reward matrix (#${editionNumber}) evaluating ${quote.companyName} support at $${supportNum.toFixed(2)} vs $${resistNum.toFixed(2)} resistance at spot ${quote.priceFormatted} (${sentimentLabel}).`,
      `Strategic multi-month update (#${editionNumber}) on ${quote.symbol} covering ${t.return3mPct !== null ? `${t.return3mPct >= 0 ? '+' : ''}${t.return3mPct}%` : quote.changeFormatted} quarterly performance and ${f.dataSource} signals.`,
      `Analyst consensus note (#${editionNumber}) for ${quote.symbol} at ${quote.priceFormatted} contrasting ${f.analystTarget ? `${f.analystTarget} target` : 'street expectations'} with latest wire sentiment.`,
      `Liquidity & spread dispatch (#${editionNumber}) monitoring ${volStr} volume and ${dayRangeStr} intraday swings on ${quote.exchange}.`,
      `Macro sensitivity brief (#${editionNumber}) tracking ${quote.companyName} (${quote.symbol}) at ${quote.priceFormatted} against ${smaStr} and cross-market flows.`,
      `Breakout & accumulation watch (#${editionNumber}) mapping ${quote.symbol} demand at $${supportNum.toFixed(2)} and supply at $${resistNum.toFixed(2)} (${sentimentLabel}).`,
    ];

    const dataDrivenParagraphs = fallbackParagraphSets[angleIndex] || fallbackParagraphSets[0];

    let title = String(aiParsed?.title || '').trim() || fallbackTitles[angleIndex] || fallbackTitles[0];
    // Guard against exact or near-duplicate titles even if LLM or templates overlap prior headlines
    if (isTitleTooSimilar(title, priorTitles)) {
      if (topNews1 && !isTitleTooSimilar(`${quote.symbol} Update: ${topNews1.headline.slice(0, 68)}`, priorTitles)) {
        title = `${quote.symbol} Update (${dateStamp}): ${topNews1.headline.slice(0, 64)}`;
      } else {
        title = `${quote.symbol} ${angle.headlineTag} (${dateStamp} · #${editionNumber}): ${quote.priceFormatted} (${quote.changeFormatted})`;
      }
    }

    const summary = String(aiParsed?.summary || '').trim() || fallbackSummaries[angleIndex] || fallbackSummaries[0];

    const category =
      categoryOverride ||
      aiParsed?.category ||
      (quote.isCrypto ? 'Digital Assets' : 'Equities & Markets');

    const fallbackTagSets: string[][] = [
      [quote.symbol, 'Valuation & Multiples', quote.companyName.split(' ')[0], 'Institutional Research', quote.exchange],
      [quote.symbol, 'Technical Momentum', 'RSI & Moving Averages', 'Breakout Setup', quote.exchange],
      [quote.symbol, 'Catalyst Dispatch', 'Breaking Wire News', 'Market Sentiment', quote.exchange],
      [quote.symbol, '52-Week Range', 'Liquidity Depth', 'Order Flow', quote.exchange],
      [quote.symbol, 'Bull vs Bear Matrix', 'Risk Assessment', 'Key Levels', quote.exchange],
      [quote.symbol, '3-Month Outlook', 'Capital Allocation', 'Macro Flows', quote.exchange],
      [quote.symbol, 'Analyst Consensus', 'Earnings Check', 'Price Targets', quote.exchange],
      [quote.symbol, 'Session Liquidity', 'Intraday Spreads', 'Order Book', quote.exchange],
      [quote.symbol, 'Macro Regime', 'Cross-Asset Flows', 'Institutional Beta', quote.exchange],
      [quote.symbol, 'Accumulation Shelves', 'Breakout Watch', 'Key Levels', quote.exchange],
    ];

    const tags: string[] =
      Array.isArray(aiParsed?.tags) && aiParsed.tags.length > 0
        ? aiParsed.tags.slice(0, 6)
        : fallbackTagSets[angleIndex] || fallbackTagSets[0];

    const keyTakeaways: string[] =
      Array.isArray(aiParsed?.keyTakeaways) && aiParsed.keyTakeaways.length > 0
        ? aiParsed.keyTakeaways.slice(0, 5)
        : [
            `Live Quote & Session Range: ${quote.symbol} at ${quote.priceFormatted} (${quote.changeFormatted} 1D), intraday ${dayRangeStr}, volume ${formatCompactNumber(t.volume)} vs 20D avg ${formatCompactNumber(t.avgVolume20d)}.`,
            `52-Week & 3M Positioning: Trading at ${t.fiftyTwoWeekPct ?? 50}% of its 52W range ($${t.fiftyTwoWeekLow?.toFixed(2) ?? 'N/A'} – $${t.fiftyTwoWeekHigh?.toFixed(2) ?? 'N/A'}) with a 3-month return of ${t.return3mPct !== null ? `${t.return3mPct >= 0 ? '+' : ''}${t.return3mPct}%` : quote.changeFormatted}.`,
            `Quantitative Indicators: RSI(14) at ${rsiStr}; ${smaStr}; Support $${supportNum.toFixed(2)} / Resistance $${resistNum.toFixed(2)}.`,
            topNews1
              ? `Latest News Catalyst (${topNews1.sourceName}): "${topNews1.headline}"`
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
            source: String(h.source || rotatedNews[idx]?.sourceName || 'Market Wire'),
            url: rotatedNews[idx]?.sourceUrl,
          }))
        : rotatedNews.slice(0, 4).map((n) => ({
            text: n.headline,
            source: n.sourceName,
            url: n.sourceUrl,
          }));

    const banner: BannerSpec = {
      kicker: `AVORA ANNOUNCEMENTS • ${angle.headlineTag} • ${quote.exchange}`,
      headline: title.slice(0, 62),
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
      variant: chosenVariant,
      editionLabel,
      chartStyle: chosenChartStyle,
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

    const memeTemplates: MemeSpec['template'][] = ['sentiment-matrix', 'stonks', 'volatility', 'two-buttons', 'drake'];
    const meme: MemeSpec = {
      template: memeTemplates[(Math.max(1, editionNumber) - 1) % memeTemplates.length] || 'sentiment-matrix',
      topText: String(aiParsed?.deskTakeaway || `${quote.symbol} • ${angle.headlineTag} — ${sentimentLabel}`),
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
   * Generate a unique bespoke editorial cover artwork via OpenAI Images (when OpenAI key is set)
   * and persist it in MySQL so it survives server restarts/redeploys.
   */
  private async generateUniqueAiCoverImage(params: {
    openaiApiKey: string;
    slug: string;
    companyName: string;
    ticker: string;
    title: string;
    editionNumber: number;
    variant: string;
  }): Promise<string | null> {
    if (!params.openaiApiKey) return null;
    try {
      const styleMotifs = [
        'futuristic institutional trading floor architecture with emerald glass light rays',
        'abstract 3D brushed titanium and gold financial sculpture on deep obsidian velvet',
        'minimalist cobalt blue isometric global liquidity network and geometric wave forms',
        'sleek ultra-modern private bank vault atrium with warm amber and slate reflections',
        'abstract high-frequency market telemetry ribbons in teal and violet neon on dark matte steel',
        'editorial financial magazine cover photography style, dark marble desk with subtle holographic chart reflections',
        'dramatic glass skyscraper trading atrium at dawn with warm horizon glow and reflections',
        'precision Swiss mechanical chronometer macro inspired fintech aesthetic in silver and slate',
        'global sunlit fiber-optic capital flow sculpture against deep midnight indigo gradient',
        'architectural minimalist trading desk hologram with crisp cyan wireframe planes',
      ];
      const motif = styleMotifs[(params.editionNumber - 1 + Math.floor(Date.now() / 60000)) % styleMotifs.length];
      const prompt = `Create a clean, ultra-sharp editorial hero image for an official financial announcement about ${params.companyName} (${params.ticker}). Visual direction: ${motif}. Theme focus: ${params.title}. Strictly NO text, NO letters, NO numbers, NO watermarks, widescreen cinematic dark fintech aesthetic.`;

      const res = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${params.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size: '1792x1024',
          quality: 'standard',
          response_format: 'b64_json',
        }),
        signal: AbortSignal.timeout(22000),
      });

      if (!res.ok) return null;
      const json: any = await res.json();
      const b64 = json?.data?.[0]?.b64_json;
      if (!b64) return null;

      const buffer = Buffer.from(b64, 'base64');
      const urlPath = `/uploads/ai-covers/${params.slug}.png`;
      await persistUploadedBuffer({
        urlPath,
        buffer,
        mimeType: 'image/png',
        originalName: `${params.slug}.png`,
      });
      return urlPath;
    } catch (err) {
      console.warn('[AutoContent] Bespoke AI cover fallback to themed SVG banner:', err);
      return null;
    }
  }

  private extractUsedHeadlineKeys(posts: Array<{ highlights?: string | null }>): Set<string> {
    const used = new Set<string>();
    for (const p of posts) {
      if (!p.highlights) continue;
      try {
        const arr = JSON.parse(p.highlights);
        if (Array.isArray(arr)) {
          for (const h of arr) {
            const text = String(h?.text || h || '').trim();
            if (text.length >= 10) {
              used.add(hashNewsKey(text, String(h?.url || text)));
            }
          }
        }
      } catch {}
    }
    return used;
  }

  private parseEditionNumberFromBanner(bannerData?: string | null): number {
    if (!bannerData) return 0;
    try {
      const parsed = JSON.parse(bannerData);
      const match = String(parsed?.editionLabel || '').match(/DISPATCH\s*#(\d+)/i);
      return match ? Number(match[1]) || 0 : 0;
    } catch {
      return 0;
    }
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

    // Inspect prior posts on the same ticker/topic AND overall recent AI posts so every announcement stays distinct & non-repetitive
    const [topicPriorPosts, globalRecentAiPosts] = await Promise.all([
      prisma.blogPost
        .findMany({
          where: {
            OR: [{ ticker: quote.symbol }, { topicQuery: topic }],
          },
          orderBy: { publishedAt: 'desc' },
          take: 15,
          select: { id: true, title: true, summary: true, bannerData: true, highlights: true },
        })
        .catch(() => []),
      prisma.blogPost
        .findMany({
          where: { ticker: { not: null } },
          orderBy: { publishedAt: 'desc' },
          take: 12,
          select: { id: true, title: true, summary: true, bannerData: true, highlights: true },
        })
        .catch(() => []),
    ]);

    const seenIds = new Set<string>();
    const combinedPrior = [...topicPriorPosts, ...globalRecentAiPosts].filter((p) => {
      if (seenIds.has(p.id)) return false;
      seenIds.add(p.id);
      return true;
    });

    const priorCount = topicPriorPosts.length;
    const priorMaxEdition = topicPriorPosts.reduce(
      (max, p) => Math.max(max, this.parseEditionNumberFromBanner(p.bannerData)),
      0
    );
    const editionNumber = Math.max(priorCount + 1, priorMaxEdition + 1);
    const priorTitles = combinedPrior.map((p) => p.title).filter(Boolean);
    const priorSummaries = combinedPrior.map((p) => p.summary).filter(Boolean);
    const usedHeadlineKeys = this.extractUsedHeadlineKeys(combinedPrior);

    let lastVariant = '';
    try {
      if (combinedPrior[0]?.bannerData) {
        const parsed = JSON.parse(combinedPrior[0].bannerData);
        lastVariant = String(parsed?.variant || '');
      }
    } catch {}

    const variantPool = [
      'emerald-grid',
      'cobalt-terminal',
      'amber-bullion',
      'violet-quant',
      'cyan-horizon',
      'crimson-brief',
    ];
    let nextVariant = variantPool[(editionNumber - 1) % variantPool.length];
    if (nextVariant === lastVariant) {
      nextVariant = variantPool[editionNumber % variantPool.length];
    }

    const news = await this.fetchReliableNews(quote, topic, aiCfg.finnhubApiKey, usedHeadlineKeys);
    const pkg = await this.generateEditorialPackage({
      topic,
      quote,
      news,
      categoryOverride: params.categoryOverride,
      includeMeme: params.includeMeme !== false,
      priorTitles,
      priorSummaries,
      usedHeadlineKeys,
      editionNumber,
      visualVariant: nextVariant,
    });

    const slug = slugify(`${quote.symbol}-${pkg.title.slice(0, 48)}`);
    const bannerSvgUrl = `/api/v1/cms/media/banner/${slug}.svg`;
    const memeUrl = pkg.meme ? `/api/v1/cms/media/meme/${slug}.svg` : null;

    // Try bespoke AI cover image when OpenAI key is configured; cleanly fall back to themed unique SVG banner
    const customAiCoverUrl = aiCfg.openaiApiKey
      ? await this.generateUniqueAiCoverImage({
          openaiApiKey: aiCfg.openaiApiKey,
          slug,
          companyName: quote.companyName,
          ticker: quote.symbol,
          title: pkg.title,
          editionNumber,
          variant: nextVariant,
        })
      : null;

    const coverImage = customAiCoverUrl || bannerSvgUrl;

    const post = await prisma.blogPost.create({
      data: {
        slug,
        title: pkg.title.slice(0, 250),
        summary: pkg.summary,
        content: pkg.content,
        coverImage,
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
   * Refresh live quote, quantitative article/banner/sentiment data, and latest news for an existing tracked post.
   * When regenerateReport=true, advances edition & publishedAt so refreshed AI announcements never stay stuck on an old headline/date.
   */
  async syncPostNews(postId: string, regenerateReport = false) {
    await this.ensureSchema();
    const post = await prisma.blogPost.findUnique({ where: { id: postId } });
    if (!post || (!post.ticker && !post.topicQuery)) return null;

    const aiCfg = await this.getAiConfig();
    const siblingPosts = await prisma.blogPost
      .findMany({
        where: {
          OR: [
            ...(post.ticker ? [{ ticker: post.ticker }] : []),
            ...(post.topicQuery ? [{ topicQuery: post.topicQuery }] : []),
          ],
        },
        orderBy: { publishedAt: 'asc' },
        select: { id: true, title: true, summary: true, highlights: true, bannerData: true },
      })
      .catch(() => []);

    const usedHeadlineKeys = this.extractUsedHeadlineKeys(
      regenerateReport ? siblingPosts : siblingPosts.filter((s) => s.id !== post.id)
    );

    const quote = await this.resolveTopicAndQuote(post.ticker || post.topicQuery || post.title);
    const news = await this.fetchReliableNews(
      quote,
      post.topicQuery || post.ticker || post.title,
      aiCfg.finnhubApiKey,
      usedHeadlineKeys
    );

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
      take: 18,
    });

    const siblingIdx = Math.max(0, siblingPosts.findIndex((s) => s.id === post.id));
    const currentEdition = this.parseEditionNumberFromBanner(post.bannerData) || siblingIdx + 1;
    const editionNumber = regenerateReport ? currentEdition + 1 : currentEdition;

    const priorTitles = (
      regenerateReport ? siblingPosts : siblingPosts.filter((s) => s.id !== post.id)
    )
      .map((s) => s.title)
      .filter(Boolean);
    const priorSummaries = (
      regenerateReport ? siblingPosts : siblingPosts.filter((s) => s.id !== post.id)
    )
      .map((s) => s.summary)
      .filter(Boolean);

    const variantPool = [
      'emerald-grid',
      'cobalt-terminal',
      'amber-bullion',
      'violet-quant',
      'cyan-horizon',
      'crimson-brief',
    ];
    let existingVariant = variantPool[siblingIdx % variantPool.length];
    try {
      if (post.bannerData) {
        const parsedBanner = JSON.parse(post.bannerData);
        if (parsedBanner?.variant && variantPool.includes(parsedBanner.variant)) {
          existingVariant = parsedBanner.variant;
        }
      }
    } catch {}
    if (regenerateReport) {
      const currentVarIdx = variantPool.indexOf(existingVariant);
      existingVariant = variantPool[(Math.max(0, currentVarIdx) + 1) % variantPool.length];
    } else if (siblingIdx > 0 && existingVariant === variantPool[0]) {
      existingVariant = variantPool[siblingIdx % variantPool.length];
    }

    const pkg = await this.generateEditorialPackage({
      topic: post.topicQuery || post.ticker || post.title,
      quote,
      news: news.length > 0 ? news : (latestNews as any),
      categoryOverride: post.category,
      includeMeme: Boolean(post.memeUrl),
      priorTitles,
      priorSummaries,
      usedHeadlineKeys,
      editionNumber,
      visualVariant: existingVariant,
    });

    if (!regenerateReport) {
      // Preserve current headline on background live-metric/wire refresh so URL readers don't see title jump mid-read
      pkg.banner.headline = post.title.slice(0, 62);
    }

    const updatedPost = await prisma.blogPost.update({
      where: { id: post.id },
      data: {
        ...(regenerateReport
          ? {
              title: pkg.title.slice(0, 250),
              summary: pkg.summary,
              content: pkg.content,
              tags: pkg.tags.join(', '),
              keyTakeaways: JSON.stringify(pkg.keyTakeaways),
              readTime: pkg.readTime,
              publishedAt: new Date(),
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

  async syncAllTrackedPosts(forceRegenerate = false) {
    await this.ensureSchema();
    const posts = await prisma.blogPost.findMany({
      where: { autoTrackNews: true, isPublished: true, ticker: { not: null } },
      orderBy: { lastNewsSync: 'asc' },
      take: 15,
    });

    const regenerateCutoffMs = Date.now() - 55 * 60 * 1000;
    let totalAdded = 0;
    let regeneratedCount = 0;
    for (const p of posts) {
      try {
        const shouldRegenerate =
          forceRegenerate ||
          !p.lastNewsSync ||
          new Date(p.lastNewsSync).getTime() < regenerateCutoffMs;
        const res = await this.syncPostNews(p.id, shouldRegenerate);
        if (res) {
          totalAdded += res.addedCount;
          if (shouldRegenerate) regeneratedCount += 1;
        }
      } catch (err) {
        console.warn(`[AutoContent] Sync failed for ${p.slug}:`, err);
      }
    }
    return { syncedPosts: posts.length, regeneratedCount, addedStories: totalAdded };
  }

  /**
   * Autonomous Fresh AI Announcement Publisher:
   * Rotates through institutional watchlist topics and publishes a completely fresh, non-repeating
   * AI market announcement whenever the configured interval has elapsed (or force=true).
   */
  async runAutonomousFreshPublisher(force = false) {
    await this.ensureSchema();
    const cfg = await this.getAiConfig();
    if (!force && !cfg.autoPublishEnabled) {
      return { published: false, reason: 'autonomous_disabled' };
    }

    const recentAiPosts = await prisma.blogPost
      .findMany({
        where: { ticker: { not: null }, isPublished: true },
        orderBy: { publishedAt: 'desc' },
        take: 15,
        select: { ticker: true, topicQuery: true, publishedAt: true },
      })
      .catch(() => []);

    const latestPublishedAt =
      recentAiPosts[0]?.publishedAt ||
      (cfg.lastAutoPublishAt ? new Date(cfg.lastAutoPublishAt) : null);

    const intervalMs = cfg.autoPublishIntervalHours * 3600 * 1000;
    if (!force && latestPublishedAt && Date.now() - new Date(latestPublishedAt).getTime() < intervalMs) {
      return { published: false, reason: 'interval_not_elapsed' };
    }

    const watchlist = parseTopicsList(cfg.autoPublishTopics);
    // Pick topic in watchlist least recently published (never repeat the most recent topic consecutively)
    const lastTopic = (recentAiPosts[0]?.topicQuery || '').toLowerCase();
    const lastTicker = (recentAiPosts[0]?.ticker || '').toLowerCase();

    const scoreTopicRecency = (candidate: string): number => {
      const lc = candidate.toLowerCase();
      const idx = recentAiPosts.findIndex((p) => {
        const pTopic = (p.topicQuery || '').toLowerCase();
        const pTicker = (p.ticker || '').toLowerCase();
        return pTopic === lc || pTicker === lc || (KNOWN_ENTITIES[lc]?.symbol.toLowerCase() === pTicker);
      });
      return idx === -1 ? 999 : idx;
    };

    const nonConsecutivePool = watchlist.filter((t) => {
      const lc = t.toLowerCase();
      const knownSym = KNOWN_ENTITIES[lc]?.symbol.toLowerCase();
      return lc !== lastTopic && lc !== lastTicker && (!knownSym || knownSym !== lastTicker);
    });
    const candidates = nonConsecutivePool.length > 0 ? nonConsecutivePool : watchlist;
    const chosenTopic = candidates.sort((a, b) => scoreTopicRecency(b) - scoreTopicRecency(a))[0];

    const result = await this.publishAutomatedPost({
      topic: chosenTopic,
      includeMeme: true,
      autoTrackNews: true,
    });

    await prisma.cmsSetting.upsert({
      where: { key: 'ai_last_auto_publish_at' },
      update: { value: new Date().toISOString(), group: 'AI_CONTENT' },
      create: { key: 'ai_last_auto_publish_at', value: new Date().toISOString(), group: 'AI_CONTENT' },
    });

    return {
      published: true,
      topic: chosenTopic,
      post: result.post,
      stats: result.stats,
    };
  }

  /**
   * Single-flight non-blocking freshness guard triggered when public pages query /announcements
   */
  async runScheduledFreshnessIfDue() {
    if (this.freshnessInFlight) return this.freshnessInFlight;
    this.freshnessInFlight = (async () => {
      try {
        await this.runAutonomousFreshPublisher(false);
        const staleCutoff = new Date(Date.now() - 45 * 60 * 1000);
        const hasStale = await prisma.blogPost.findFirst({
          where: {
            autoTrackNews: true,
            isPublished: true,
            ticker: { not: null },
            OR: [{ lastNewsSync: null }, { lastNewsSync: { lt: staleCutoff } }],
          },
          select: { id: true },
        });
        if (hasStale) {
          await this.syncAllTrackedPosts(false);
        }
      } catch (err) {
        console.warn('[AutoContent] Scheduled freshness pass note:', err);
      } finally {
        this.freshnessInFlight = null;
      }
    })();
    return this.freshnessInFlight;
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

    const PALETTES: Record<
      string,
      { bg1: string; bg2: string; bg3: string; panel: string; grid: string; badgeBg: string; badgeText: string; subAccent: string }
    > = {
      'emerald-grid': {
        bg1: '#050811',
        bg2: '#0A1124',
        bg3: '#071923',
        panel: '#0F172A',
        grid: '#1E293B',
        badgeBg: '#10B981',
        badgeText: '#34D399',
        subAccent: '#38BDF8',
      },
      'cobalt-terminal': {
        bg1: '#04091A',
        bg2: '#0B1838',
        bg3: '#111D4A',
        panel: '#0B142C',
        grid: '#1E3A8A',
        badgeBg: '#3B82F6',
        badgeText: '#93C5FD',
        subAccent: '#34D399',
      },
      'amber-bullion': {
        bg1: '#120C04',
        bg2: '#1C140A',
        bg3: '#24180B',
        panel: '#171109',
        grid: '#451A03',
        badgeBg: '#F59E0B',
        badgeText: '#FCD34D',
        subAccent: '#34D399',
      },
      'violet-quant': {
        bg1: '#0B0617',
        bg2: '#170E2E',
        bg3: '#101936',
        panel: '#120C24',
        grid: '#312E81',
        badgeBg: '#8B5CF6',
        badgeText: '#C4B5FD',
        subAccent: '#2DD4BF',
      },
      'cyan-horizon': {
        bg1: '#031217',
        bg2: '#07222C',
        bg3: '#0B172A',
        panel: '#071B24',
        grid: '#164E63',
        badgeBg: '#06B6D4',
        badgeText: '#67E8F9',
        subAccent: '#A7F3D0',
      },
      'crimson-brief': {
        bg1: '#14050B',
        bg2: '#1E0A16',
        bg3: '#0F172A',
        panel: '#160B14',
        grid: '#4C0519',
        badgeBg: '#EC4899',
        badgeText: '#F9A8D4',
        subAccent: '#38BDF8',
      },
    };

    const paletteKey = spec.variant && PALETTES[spec.variant] ? spec.variant : 'emerald-grid';
    const pal = PALETTES[paletteKey];
    const accent = spec.isPositive ? '#10B981' : '#F43F5E';

    // Build SVG sparkline inside Right Terminal Chart Box (x: 645..1115, y: 245..455)
    const pts = spec.sparkline.length >= 2 ? spec.sparkline : [10, 12, 11, 14, 15];
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const span = max - min || 1;
    const coordPairs = pts.map((v, i) => {
      const x = 650 + (i / (pts.length - 1)) * 460;
      const y = 445 - ((v - min) / span) * 190;
      return { x, y };
    });
    const coords = coordPairs.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`);
    const linePath = `M ${coords.join(' L ')}`;
    const areaPath = `${linePath} L 1110,465 L 650,465 Z`;

    const barsMarkup = coordPairs
      .map((c, idx) => {
        const barW = Math.max(6, Math.floor(420 / coordPairs.length) - 4);
        const h = Math.max(12, 462 - c.y);
        const barOpacity = idx === coordPairs.length - 1 ? 0.9 : 0.42;
        return `<rect x="${(c.x - barW / 2).toFixed(1)}" y="${c.y.toFixed(1)}" width="${barW}" height="${h.toFixed(1)}" rx="3" fill="${accent}" fill-opacity="${barOpacity}"/>`;
      })
      .join('\n  ');

    const dotsMarkup = coordPairs
      .filter((_, idx) => idx % 2 === 0 || idx === coordPairs.length - 1)
      .map(
        (c, idx, arr) =>
          `<circle cx="${c.x.toFixed(1)}" cy="${c.y.toFixed(1)}" r="${idx === arr.length - 1 ? 6 : 3.5}" fill="${idx === arr.length - 1 ? '#FFFFFF' : pal.badgeText}" stroke="${accent}" stroke-width="2"/>`
      )
      .join('\n  ');

    const chartVisual =
      spec.chartStyle === 'bars'
        ? `${barsMarkup}\n  <path d="${linePath}" fill="none" stroke="#FFFFFF" stroke-opacity="0.7" stroke-width="2" stroke-dasharray="4 4"/>`
        : spec.chartStyle === 'dots'
        ? `<path d="${areaPath}" fill="url(#areaGrad)" fill-opacity="0.5"/>\n  <path d="${linePath}" fill="none" stroke="${pal.badgeText}" stroke-width="3.5" stroke-linecap="round"/>\n  ${dotsMarkup}`
        : `<path d="${areaPath}" fill="url(#areaGrad)"/>\n  <path d="${linePath}" fill="none" stroke="${accent}" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/>`;

    // Strictly wrap headline to 21 chars so it NEVER crosses x=585
    const headlineLines = wrapText(spec.headline, 21, 2);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${pal.bg1}"/>
      <stop offset="55%" stop-color="${pal.bg2}"/>
      <stop offset="100%" stop-color="${pal.bg3}"/>
    </linearGradient>
    <radialGradient id="orb" cx="80%" cy="35%" r="45%">
      <stop offset="0%" stop-color="${pal.badgeBg}" stop-opacity="0.26"/>
      <stop offset="100%" stop-color="${pal.badgeBg}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.0"/>
    </linearGradient>
    <clipPath id="leftClip">
      <rect x="0" y="0" width="595" height="630"/>
    </clipPath>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#orb)"/>

  <!-- Terminal Grid -->
  <g stroke="${pal.grid}" stroke-width="1" stroke-opacity="0.45">
    <line x1="0" y1="126" x2="1200" y2="126"/>
    <line x1="0" y1="252" x2="1200" y2="252"/>
    <line x1="0" y1="378" x2="1200" y2="378"/>
    <line x1="0" y1="504" x2="1200" y2="504"/>
    <line x1="600" y1="0" x2="600" y2="630"/>
  </g>

  <!-- LEFT COLUMN (Strictly Clipped so text never overlaps right chart) -->
  <g clip-path="url(#leftClip)">
    <rect x="56" y="56" width="490" height="32" rx="16" fill="${pal.badgeBg}" fill-opacity="0.16" stroke="${pal.badgeBg}" stroke-opacity="0.45"/>
    <circle cx="76" cy="72" r="4.5" fill="${pal.badgeBg}"/>
    <text x="90" y="77" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="11" font-weight="800" letter-spacing="1.1" fill="${pal.badgeText}">${escapeXml((spec.editionLabel || spec.kicker).slice(0, 44))}</text>

    <g font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="38" font-weight="900" fill="#FFFFFF">
      ${headlineLines.map((line, i) => `<text x="56" y="${144 + i * 46}">${escapeXml(line)}</text>`).join('\n      ')}
    </g>

    <!-- Quantitative Data KPIs Box on Left -->
    <rect x="56" y="232" width="516" height="240" rx="20" fill="${pal.panel}" fill-opacity="0.88" stroke="${pal.grid}" stroke-width="1.5"/>

    <text x="80" y="268" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#64748B">INTRADAY RANGE</text>
    <text x="80" y="290" font-family="monospace" font-size="15" font-weight="800" fill="#F8FAFC">${escapeXml(spec.dayRangeText.slice(0, 26))}</text>

    <text x="320" y="268" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#64748B">SESSION VOLUME</text>
    <text x="320" y="290" font-family="monospace" font-size="15" font-weight="800" fill="#F8FAFC">${escapeXml(spec.volumeText.slice(0, 24))}</text>

    <line x1="80" y1="310" x2="548" y2="310" stroke="${pal.grid}" stroke-width="1"/>

    <text x="80" y="338" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#64748B">52-WEEK BAND</text>
    <text x="80" y="360" font-family="monospace" font-size="14" font-weight="800" fill="${pal.subAccent}">${escapeXml(spec.fiftyTwoWeekText.slice(0, 30))}</text>

    <text x="320" y="338" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#64748B">RSI (14D) MOMENTUM</text>
    <text x="320" y="360" font-family="monospace" font-size="14" font-weight="800" fill="${pal.badgeText}">${escapeXml(spec.rsiText.slice(0, 24))}</text>

    <line x1="80" y1="380" x2="548" y2="380" stroke="${pal.grid}" stroke-width="1"/>

    <text x="80" y="408" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#64748B">MOVING AVERAGES</text>
    <text x="80" y="430" font-family="monospace" font-size="13" font-weight="700" fill="#CBD5E1">${escapeXml(spec.smaText.slice(0, 42))}</text>

    <text x="80" y="456" font-family="system-ui, sans-serif" font-size="10" font-weight="700" fill="#64748B">DATA FEED: ${escapeXml(spec.dataSource.toUpperCase())}</text>

    <!-- Brand Footer -->
    <rect x="56" y="516" width="38" height="38" rx="10" fill="${pal.badgeBg}"/>
    <text x="75" y="542" text-anchor="middle" font-family="system-ui, sans-serif" font-size="21" font-weight="900" fill="#FFFFFF">A</text>
    <text x="108" y="534" font-family="system-ui, sans-serif" font-size="17" font-weight="800" fill="#F8FAFC">Avora Bank Announcements</text>
    <text x="108" y="553" font-family="system-ui, sans-serif" font-size="11" font-weight="600" fill="#64748B">DESK DISPATCH • ${escapeXml(slug.slice(0, 28))}</text>
  </g>

  <!-- RIGHT COLUMN: 3-MONTH PRICE CURVE & QUOTE TERMINAL -->
  <rect x="620" y="56" width="524" height="500" rx="26" fill="${pal.panel}" fill-opacity="0.92" stroke="${pal.grid}" stroke-width="2"/>

  <rect x="650" y="84" width="130" height="36" rx="10" fill="${pal.badgeBg}" fill-opacity="0.22" stroke="${pal.badgeBg}" stroke-opacity="0.4"/>
  <text x="715" y="107" text-anchor="middle" font-family="monospace" font-size="16" font-weight="900" fill="#FFFFFF">${escapeXml(spec.ticker)}</text>
  <text x="650" y="144" font-family="system-ui, sans-serif" font-size="12" font-weight="700" fill="#64748B">3-MONTH DAILY CLOSE TRAJECTORY (${escapeXml(spec.exchange)})</text>

  <text x="1114" y="110" text-anchor="end" font-family="monospace" font-size="28" font-weight="900" fill="#FFFFFF">${escapeXml(spec.priceText)}</text>
  <rect x="1004" y="122" width="110" height="30" rx="8" fill="${accent}" fill-opacity="0.18"/>
  <text x="1059" y="142" text-anchor="middle" font-family="monospace" font-size="15" font-weight="900" fill="${accent}">${escapeXml(spec.changeText)} (1D)</text>

  <line x1="650" y1="172" x2="1114" y2="172" stroke="${pal.grid}" stroke-width="1"/>

  <!-- Price High/Low Labels & Chart -->
  <text x="1114" y="232" text-anchor="end" font-family="monospace" font-size="11" fill="#64748B">3M High: $${max.toFixed(2)}</text>
  ${chartVisual}
  <text x="1114" y="488" text-anchor="end" font-family="monospace" font-size="11" fill="#64748B">3M Low: $${min.toFixed(2)}</text>

  <text x="650" y="528" font-family="monospace" font-size="11" font-weight="700" fill="#94A3B8">LIVE TERMINAL SNAPSHOT • UNIQUE EDITION</text>
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
