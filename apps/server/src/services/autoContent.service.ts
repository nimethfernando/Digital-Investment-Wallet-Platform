import crypto from 'crypto';
import { prisma } from '../lib/prisma';

export interface MarketQuote {
  symbol: string;
  companyName: string;
  exchange: string;
  currency: string;
  price: number | null;
  prevClose: number | null;
  changePct: number | null;
  priceFormatted: string;
  changeFormatted: string;
  sparkline: number[];
  isCrypto: boolean;
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
  priceText: string;
  changeText: string;
  isPositive: boolean;
  sparkline: number[];
}

export interface MemeSpec {
  template: 'stonks' | 'two-buttons' | 'drake' | 'volatility';
  topText: string;
  bottomText: string;
  ticker: string;
  changeText: string;
}

const KNOWN_ENTITIES: Record<string, { symbol: string; companyName: string; exchange: string; isCrypto?: boolean }> = {
  apple: { symbol: 'AAPL', companyName: 'Apple Inc.', exchange: 'NASDAQ' },
  aapl: { symbol: 'AAPL', companyName: 'Apple Inc.', exchange: 'NASDAQ' },
  tesla: { symbol: 'TSLA', companyName: 'Tesla, Inc.', exchange: 'NASDAQ' },
  tsla: { symbol: 'TSLA', companyName: 'Tesla, Inc.', exchange: 'NASDAQ' },
  nvidia: { symbol: 'NVDA', companyName: 'NVIDIA Corporation', exchange: 'NASDAQ' },
  nvda: { symbol: 'NVDA', companyName: 'NVIDIA Corporation', exchange: 'NASDAQ' },
  microsoft: { symbol: 'MSFT', companyName: 'Microsoft Corporation', exchange: 'NASDAQ' },
  msft: { symbol: 'MSFT', companyName: 'Microsoft Corporation', exchange: 'NASDAQ' },
  amazon: { symbol: 'AMZN', companyName: 'Amazon.com, Inc.', exchange: 'NASDAQ' },
  amzn: { symbol: 'AMZN', companyName: 'Amazon.com, Inc.', exchange: 'NASDAQ' },
  google: { symbol: 'GOOGL', companyName: 'Alphabet Inc.', exchange: 'NASDAQ' },
  alphabet: { symbol: 'GOOGL', companyName: 'Alphabet Inc.', exchange: 'NASDAQ' },
  googl: { symbol: 'GOOGL', companyName: 'Alphabet Inc.', exchange: 'NASDAQ' },
  meta: { symbol: 'META', companyName: 'Meta Platforms, Inc.', exchange: 'NASDAQ' },
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
  netflix: { symbol: 'NFLX', companyName: 'Netflix, Inc.', exchange: 'NASDAQ' },
  nflx: { symbol: 'NFLX', companyName: 'Netflix, Inc.', exchange: 'NASDAQ' },
  amd: { symbol: 'AMD', companyName: 'Advanced Micro Devices', exchange: 'NASDAQ' },
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
    if ((current + ' ' + w).trim().length <= maxChars) {
      current = (current + ' ' + w).trim();
    } else {
      if (current) lines.push(current);
      current = w;
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

function classifySentiment(text: string): 'BULLISH' | 'BEARISH' | 'NEUTRAL' {
  const lower = text.toLowerCase();
  const bullWords = ['surge', 'rally', 'record', 'beat', 'upgrade', 'growth', 'soar', 'buyback', 'trillion', 'gain', 'profit', 'breakout', 'outperform', 'bull'];
  const bearWords = ['drop', 'fall', 'plunge', 'slump', 'miss', 'downgrade', 'lawsuit', 'probe', 'decline', 'cut', 'loss', 'concern', 'tariff', 'bear', 'risk'];
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

  /**
   * Non-destructive idempotent schema check for diw_blog_posts extensions & diw_blog_news_updates.
   * Safe for shared MySQL instances where full prisma db push is undesired.
   */
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

  /**
   * Read AI & News API configuration from CmsSetting or environment variables
   */
  async getAiConfig() {
    const keys = await prisma.cmsSetting.findMany({
      where: { key: { in: ['ai_openai_api_key', 'ai_gemini_api_key', 'ai_finnhub_api_key'] } },
    });
    const map: Record<string, string> = {};
    for (const k of keys) map[k.key] = k.value;

    return {
      openaiApiKey: (map.ai_openai_api_key || process.env.OPENAI_API_KEY || '').trim(),
      geminiApiKey: (map.ai_gemini_api_key || process.env.GEMINI_API_KEY || '').trim(),
      finnhubApiKey: (map.ai_finnhub_api_key || process.env.FINNHUB_API_KEY || '').trim(),
    };
  }

  async getPublicAiStatus() {
    const cfg = await this.getAiConfig();
    return {
      openaiConfigured: Boolean(cfg.openaiApiKey),
      geminiConfigured: Boolean(cfg.geminiApiKey),
      finnhubConfigured: Boolean(cfg.finnhubApiKey),
      engineMode: cfg.openaiApiKey
        ? 'OpenAI GPT-4o-mini + Live Feeds'
        : cfg.geminiApiKey
        ? 'Google Gemini 2.5 Flash + Live Feeds'
        : 'Built-in Live Financial Synthesis + RSS Feeds',
    };
  }

  async saveAiConfig(data: { openaiApiKey?: string; geminiApiKey?: string; finnhubApiKey?: string }) {
    const updates: Array<{ key: string; value: string }> = [];
    if (typeof data.openaiApiKey === 'string') updates.push({ key: 'ai_openai_api_key', value: data.openaiApiKey.trim() });
    if (typeof data.geminiApiKey === 'string') updates.push({ key: 'ai_gemini_api_key', value: data.geminiApiKey.trim() });
    if (typeof data.finnhubApiKey === 'string') updates.push({ key: 'ai_finnhub_api_key', value: data.finnhubApiKey.trim() });

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
   * Resolve user query like "Apple Inc." or "AAPL" or "Tesla" into a live stock/crypto quote
   */
  async resolveTopicAndQuote(topic: string): Promise<MarketQuote> {
    const cleaned = topic.trim();
    const key = cleaned.toLowerCase().replace(/\b(inc|corp|corporation|stock|shares|news|price)\b/g, '').trim();

    let symbol = '';
    let companyName = cleaned;
    let exchange = 'GLOBAL';
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
      // Query Yahoo Finance search API
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
      } catch {
        // fallback cleanly
      }
    }

    if (!symbol) {
      symbol = cleaned.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'MARKET';
    }

    // Fetch live chart & price via Yahoo v8 endpoint
    let price: number | null = null;
    let prevClose: number | null = null;
    let currency = 'USD';
    let sparkline: number[] = [];

    try {
      const chartRes = await fetch(
        `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`,
        { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5000) }
      );
      if (chartRes.ok) {
        const chartJson: any = await chartRes.json();
        const result = chartJson?.chart?.result?.[0];
        const meta = result?.meta;
        if (meta) {
          if (typeof meta.regularMarketPrice === 'number') price = meta.regularMarketPrice;
          if (typeof meta.chartPreviousClose === 'number') prevClose = meta.chartPreviousClose;
          if (typeof meta.previousClose === 'number') prevClose = meta.previousClose;
          if (meta.currency) currency = meta.currency;
          if (meta.exchangeName) exchange = meta.exchangeName;
          if (meta.longName || meta.shortName) companyName = meta.longName || meta.shortName;
        }
        const closes = result?.indicators?.quote?.[0]?.close;
        if (Array.isArray(closes)) {
          sparkline = closes.filter((n: any) => typeof n === 'number' && !Number.isNaN(n)).slice(-18);
          if (price !== null && sparkline.length >= 2) {
            prevClose = prevClose ?? sparkline[sparkline.length - 2];
          }
        }
      }
    } catch {
      // keep safe defaults if network blocks Yahoo
    }

    const changePct =
      price !== null && prevClose !== null && prevClose > 0
        ? ((price - prevClose) / prevClose) * 100
        : null;

    const priceFormatted = price !== null ? `${price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}` : 'Live Quote Tracking';
    const changeFormatted =
      changePct !== null ? `${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%` : '+0.00%';

    return {
      symbol: symbol.replace('-USD', ''),
      companyName,
      exchange,
      currency,
      price,
      prevClose,
      changePct,
      priceFormatted,
      changeFormatted,
      sparkline: sparkline.length >= 4 ? sparkline : [100, 102, 101, 104, 103, 106, 108, 107, 111],
      isCrypto,
    };
  }

  /**
   * Gather verified market news from Google News RSS, Yahoo Finance RSS, and optional Finnhub API
   */
  async fetchReliableNews(quote: MarketQuote, originalTopic: string, finnhubKey?: string): Promise<RawNewsItem[]> {
    const items: RawNewsItem[] = [];
    const queryTerm = quote.companyName && quote.companyName !== quote.symbol ? `${quote.companyName} ${quote.symbol}` : originalTopic;

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

        // Google News puts " - Source Name" at the end of title
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
      // 1. Google News RSS
      fetch(
        `https://news.google.com/rss/search?q=${encodeURIComponent(`${queryTerm} when:7d`)}&hl=en-US&gl=US&ceid=US:en`,
        { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5500) }
      )
        .then(async (r) => {
          if (r.ok) parseRss(await r.text(), 'Google News');
        })
        .catch(() => {}),

      // 2. Yahoo Finance RSS
      fetch(
        `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(quote.isCrypto ? `${quote.symbol}-USD` : quote.symbol)}&region=US&lang=en-US`,
        { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(5500) }
      )
        .then(async (r) => {
          if (r.ok) parseRss(await r.text(), 'Yahoo Finance');
        })
        .catch(() => {}),
    ];

    // 3. Optional Finnhub API
    if (finnhubKey && !quote.isCrypto) {
      const to = new Date().toISOString().slice(0, 10);
      const from = new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10);
      tasks.push(
        fetch(
          `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(quote.symbol)}&from=${from}&to=${to}&token=${encodeURIComponent(finnhubKey)}`,
          { signal: AbortSignal.timeout(5000) }
        )
          .then(async (r) => {
            if (!r.ok) return;
            const arr: any = await r.json();
            if (Array.isArray(arr)) {
              for (const n of arr.slice(0, 10)) {
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

    await Promise.allSettled(tasks);

    // Deduplicate & sort newest first
    const seen = new Set<string>();
    const deduped: RawNewsItem[] = [];
    for (const item of items.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())) {
      if (!seen.has(item.urlHash)) {
        seen.add(item.urlHash);
        deduped.push(item);
      }
    }

    return deduped.slice(0, 12);
  }

  /**
   * Generate full editorial content (LLM-powered if configured, or smart live-data synthesis otherwise)
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

    const newsContext = news
      .slice(0, 6)
      .map((n, i) => `${i + 1}. [${n.sourceName}] ${n.headline} — ${n.summary.slice(0, 180)}`)
      .join('\n');

    const systemPrompt = `You are the Chief Markets Strategist at Avora Bank Institutional Research.
Write crisp, factual, high-conviction financial market intelligence. Never invent stock prices or fake stats; rely strictly on the provided live quote and news items.
Return ONLY valid JSON matching this exact shape:
{
  "title": "Sharp editorial headline (max 90 chars)",
  "summary": "2-sentence executive hook",
  "category": "Equities & Markets | Digital Assets | Macro & Commodities",
  "tags": ["Tag1", "Tag2", "Tag3", "Tag4"],
  "keyTakeaways": ["bullet 1", "bullet 2", "bullet 3", "bullet 4"],
  "contentParagraphs": ["para 1 (Executive Context)", "para 2 (Live Market Positioning)", "para 3 (Recent Catalyst & News Analysis)", "para 4 (Risk Considerations)", "para 5 (Institutional Outlook)"],
  "todayHighlights": [{"text": "Concise 1-2 sentence highlight grounded in real news", "source": "Exact source name"}],
  "banner": {"kicker": "AVORA MARKET INTELLIGENCE", "headline": "Short 4-7 word punchy banner title", "subtitle": "Asset snapshot subtitle"},
  "meme": {"template": "stonks | two-buttons | drake | volatility", "topText": "Witty relatable short top line (max 42 chars)", "bottomText": "Punchy bottom caption (max 42 chars)"}
}`;

    const userPrompt = `Topic requested: ${topic}
Resolved Asset: ${quote.companyName} (${quote.symbol} on ${quote.exchange})
Live Price: ${quote.priceFormatted} (${quote.changeFormatted} session move)

Latest Verified News Headlines:
${newsContext || 'No breaking wire stories available yet — provide balanced structural coverage for this asset.'}

Generate the complete institutional article, Today's Highlights bullets, editorial banner metadata, and finance meme captions.`;

    let aiParsed: any = null;

    // Try OpenAI if key configured
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
            temperature: 0.5,
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

    // Try Gemini if no OpenAI result & Gemini key configured
    if (!aiParsed && aiCfg.geminiApiKey) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(aiCfg.geminiApiKey)}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }] }],
              generationConfig: { responseMimeType: 'application/json', temperature: 0.5 },
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

    const isPositive = (quote.changePct ?? 0) >= 0;
    const defaultHighlights: HighlightBullet[] =
      news.length > 0
        ? news.slice(0, 4).map((n) => ({
            text: n.headline,
            source: n.sourceName,
            url: n.sourceUrl,
          }))
        : [
            {
              text: `${quote.companyName} (${quote.symbol}) is actively tracked at ${quote.priceFormatted} (${quote.changeFormatted}) on ${quote.exchange}.`,
              source: 'Avora Market Desk',
            },
          ];

    const fallbackParagraphs = [
      `${quote.companyName} (${quote.symbol}) remains one of the most closely watched benchmark assets on ${quote.exchange}. As of the latest market snapshot, ${quote.symbol} trades at ${quote.priceFormatted} (${quote.changeFormatted} over the previous session), drawing continuous institutional and retail capital attention across global equity and digital wealth desks.`,
      news.length > 0
        ? `Recent market coverage highlights shifting catalysts around ${quote.companyName}. Notably, ${news[0].sourceName} reported: "${news[0].headline}"${news[1] ? `, alongside commentary from ${news[1].sourceName} covering "${news[1].headline}".` : '.'} Traders and long-term allocators continue watching forward earnings guidance, margin resilience, and capital allocation announcements.`
        : `Institutional desks evaluating ${quote.companyName} focus heavily on durable operating margins, balance-sheet liquidity, capital return programs, and macroeconomic sensitivity across quarterly reporting cycles.`,
      `From a portfolio allocation standpoint, maintaining balanced exposure alongside hedged fixed-yield reserves helps cushion short-term volatility spikes. Investors tracking ${quote.symbol} typically pair directional core holdings with defensive liquidity positions to capture pullbacks cleanly.`,
      `Risk Factors & Market Structure: Rapid macro rate repricing, sector rotation, supply-chain developments, and regulatory headlines can amplify intraday swings around ${quote.symbol}. Avora Bank's automated news monitor continuously tracks verified market wires underneath this brief so readers never miss breaking developments.`,
      `Disclaimer: This automated research brief and live news digest was compiled from public market quotes and verified news wires for informational purposes only and does not constitute personalized financial advice.`,
    ];

    const memeTemplates: MemeSpec['template'][] = isPositive ? ['stonks', 'drake'] : ['two-buttons', 'volatility'];
    const defaultMeme: MemeSpec = includeMeme
      ? {
          template: memeTemplates[0],
          topText: isPositive ? `WAITING FOR ${quote.symbol} PULLBACK` : `BUYING THE ${quote.symbol} DIP`,
          bottomText: isPositive ? `${quote.symbol}: ${quote.changeFormatted} & RUNNING` : `PORTFOLIO: STAY CALM (${quote.changeFormatted})`,
          ticker: quote.symbol,
          changeText: quote.changeFormatted,
        }
      : {
          template: 'stonks',
          topText: '',
          bottomText: '',
          ticker: quote.symbol,
          changeText: quote.changeFormatted,
        };

    const title =
      aiParsed?.title ||
      `${quote.companyName} (${quote.symbol}) Market Intelligence: Live Catalyst Analysis & Real-Time News Feed`;

    const summary =
      aiParsed?.summary ||
      `Automated institutional brief covering ${quote.companyName} (${quote.symbol}) trading near ${quote.priceFormatted} (${quote.changeFormatted}), complete with key thesis points and live breaking news updates.`;

    const category =
      categoryOverride ||
      aiParsed?.category ||
      (quote.isCrypto ? 'Digital Assets' : 'Equities & Markets');

    const tags: string[] = Array.isArray(aiParsed?.tags) && aiParsed.tags.length > 0
      ? aiParsed.tags.slice(0, 6)
      : [quote.symbol, quote.companyName.split(' ')[0], 'Market Intelligence', 'Live News'];

    const keyTakeaways: string[] =
      Array.isArray(aiParsed?.keyTakeaways) && aiParsed.keyTakeaways.length > 0
        ? aiParsed.keyTakeaways.slice(0, 5)
        : [
            `Live Quote Snapshot: ${quote.symbol} last tracked at ${quote.priceFormatted} (${quote.changeFormatted}).`,
            news[0] ? `Top Catalyst (${news[0].sourceName}): ${news[0].headline}` : `Continuous 24/7 news tracker enabled for ${quote.companyName}.`,
            `Automated Highlights: Breaking updates append live underneath this briefing.`,
            `Institutional Context: Designed for streamlined monitoring alongside your Avora Bank portfolio.`,
          ];

    const paragraphs: string[] =
      Array.isArray(aiParsed?.contentParagraphs) && aiParsed.contentParagraphs.length > 0
        ? [...aiParsed.contentParagraphs, 'Note: Automated AI market synthesis for informational purposes only; not investment advice.']
        : fallbackParagraphs;

    const highlights: HighlightBullet[] =
      Array.isArray(aiParsed?.todayHighlights) && aiParsed.todayHighlights.length > 0
        ? aiParsed.todayHighlights.slice(0, 5).map((h: any, idx: number) => ({
            text: String(h.text || h),
            source: String(h.source || news[idx]?.sourceName || 'Market Wire'),
            url: news[idx]?.sourceUrl,
          }))
        : defaultHighlights;

    const banner: BannerSpec = {
      kicker: String(aiParsed?.banner?.kicker || 'AVORA BANK • MARKET INTELLIGENCE'),
      headline: String(aiParsed?.banner?.headline || `${quote.companyName} (${quote.symbol}) Live Brief`),
      subtitle: String(aiParsed?.banner?.subtitle || `Exchange: ${quote.exchange} • Live Highlights & Market Research`),
      ticker: quote.symbol,
      priceText: quote.priceFormatted,
      changeText: quote.changeFormatted,
      isPositive,
      sparkline: quote.sparkline,
    };

    const meme: MemeSpec = includeMeme
      ? {
          template: ['stonks', 'two-buttons', 'drake', 'volatility'].includes(aiParsed?.meme?.template)
            ? aiParsed.meme.template
            : defaultMeme.template,
          topText: String(aiParsed?.meme?.topText || defaultMeme.topText).slice(0, 60),
          bottomText: String(aiParsed?.meme?.bottomText || defaultMeme.bottomText).slice(0, 60),
          ticker: quote.symbol,
          changeText: quote.changeFormatted,
        }
      : defaultMeme;

    return {
      title,
      summary,
      category,
      tags,
      keyTakeaways,
      content: paragraphs.join('\n\n'),
      readTime: `${Math.max(3, Math.ceil(paragraphs.join(' ').split(/\s+/).length / 180))} min read`,
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
        authorName: pkg.usedAi ? 'Avora AI Research Engine' : 'Avora Bank Research Desk',
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
        hasMeme: Boolean(memeUrl),
      },
    };
  }

  /**
   * Fetch latest news & refresh Today's Highlights for an existing tracked post
   */
  async syncPostNews(postId: string) {
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

    // Update highlights list
    let newHighlights: HighlightBullet[] = latestNews.slice(0, 4).map((n) => ({
      text: n.headline,
      source: n.sourceName,
      url: n.sourceUrl,
    }));

    // Optionally polish Today's Highlights with LLM when newly added news exists
    if (addedCount > 0 && (aiCfg.openaiApiKey || aiCfg.geminiApiKey) && latestNews.length > 0) {
      const prompt = `Summarize the following latest news stories for ${quote.companyName} (${quote.symbol}) into 3 sharp, factual bullet points formatted as JSON {"highlights": [{"text": "...", "source": "..."}]}. News:\n${latestNews
        .slice(0, 6)
        .map((n) => `- [${n.sourceName}] ${n.headline}`)
        .join('\n')}`;

      try {
        if (aiCfg.openaiApiKey) {
          const r = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiCfg.openaiApiKey}` },
            body: JSON.stringify({
              model: 'gpt-4o-mini',
              response_format: { type: 'json_object' },
              messages: [{ role: 'user', content: prompt }],
            }),
            signal: AbortSignal.timeout(12000),
          });
          if (r.ok) {
            const j: any = await r.json();
            const parsed = JSON.parse(j?.choices?.[0]?.message?.content || '{}');
            if (Array.isArray(parsed.highlights) && parsed.highlights.length > 0) {
              newHighlights = parsed.highlights.slice(0, 4).map((h: any, idx: number) => ({
                text: String(h.text),
                source: String(h.source || latestNews[idx]?.sourceName || 'Market Wire'),
                url: latestNews[idx]?.sourceUrl,
              }));
            }
          }
        } else if (aiCfg.geminiApiKey) {
          const r = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(aiCfg.geminiApiKey)}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: { responseMimeType: 'application/json' },
              }),
              signal: AbortSignal.timeout(12000),
            }
          );
          if (r.ok) {
            const j: any = await r.json();
            const parsed = JSON.parse(j?.candidates?.[0]?.content?.parts?.[0]?.text || '{}');
            if (Array.isArray(parsed.highlights) && parsed.highlights.length > 0) {
              newHighlights = parsed.highlights.slice(0, 4).map((h: any, idx: number) => ({
                text: String(h.text),
                source: String(h.source || latestNews[idx]?.sourceName || 'Market Wire'),
                url: latestNews[idx]?.sourceUrl,
              }));
            }
          }
        }
      } catch {
        // retain structured RSS bullets
      }
    }

    // Also refresh sparkline & price on bannerData
    let updatedBannerData = post.bannerData;
    try {
      if (post.bannerData) {
        const b = JSON.parse(post.bannerData) as BannerSpec;
        b.priceText = quote.priceFormatted;
        b.changeText = quote.changeFormatted;
        b.isPositive = (quote.changePct ?? 0) >= 0;
        if (quote.sparkline.length >= 4) b.sparkline = quote.sparkline;
        updatedBannerData = JSON.stringify(b);
      }
    } catch {}

    const updatedPost = await prisma.blogPost.update({
      where: { id: post.id },
      data: {
        lastPrice: quote.priceFormatted,
        priceChange: quote.changeFormatted,
        highlights: JSON.stringify(newHighlights),
        bannerData: updatedBannerData,
        lastNewsSync: new Date(),
      },
      include: { newsUpdates: { orderBy: { publishedAt: 'desc' }, take: 20 } },
    });

    return { post: updatedPost, addedCount };
  }

  /**
   * Scheduled sync for all auto-tracked posts
   */
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
        const res = await this.syncPostNews(p.id);
        if (res) totalAdded += res.addedCount;
      } catch (err) {
        console.warn(`[AutoContent] Sync failed for ${p.slug}:`, err);
      }
    }
    return { syncedPosts: posts.length, addedStories: totalAdded };
  }

  /**
   * Render high-res institutional SVG Hero Banner
   */
  renderBannerSvg(slug: string, bannerJson?: string | null, fallbackTitle?: string): string {
    let spec: BannerSpec = {
      kicker: 'AVORA BANK • MARKET INTELLIGENCE',
      headline: fallbackTitle || 'Global Market Briefing',
      subtitle: 'Live Quote Tracking • Verified News Feed',
      ticker: 'AVORA',
      priceText: 'LIVE',
      changeText: '+0.00%',
      isPositive: true,
      sparkline: [100, 102, 101, 105, 104, 107, 109, 108, 112],
    };

    try {
      if (bannerJson) spec = { ...spec, ...JSON.parse(bannerJson) };
    } catch {}

    const accent = spec.isPositive ? '#10B981' : '#F43F5E';
    const accentGlow = spec.isPositive ? '#059669' : '#E11D48';

    // Build SVG sparkline path (placed on right half x: 680..1120, y: 170..470)
    const pts = spec.sparkline.length >= 2 ? spec.sparkline : [10, 12, 11, 14, 15];
    const min = Math.min(...pts);
    const max = Math.max(...pts);
    const span = max - min || 1;
    const coords = pts.map((v, i) => {
      const x = 670 + (i / (pts.length - 1)) * 450;
      const y = 450 - ((v - min) / span) * 230;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    const linePath = `M ${coords.join(' L ')}`;
    const areaPath = `${linePath} L 1120,490 L 670,490 Z`;

    const headlineLines = wrapText(spec.headline, 28, 3);
    const subtitleLines = wrapText(spec.subtitle, 46, 2);

    return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#040814"/>
      <stop offset="55%" stop-color="#0B132B"/>
      <stop offset="100%" stop-color="#071B24"/>
    </linearGradient>
    <radialGradient id="orb" cx="78%" cy="38%" r="48%">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${accent}" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="${accent}" stop-opacity="0.0"/>
    </linearGradient>
  </defs>

  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#orb)"/>

  <!-- Subtle Grid -->
  <g stroke="#1E293B" stroke-width="1" stroke-opacity="0.45">
    <line x1="0" y1="140" x2="1200" y2="140"/>
    <line x1="0" y1="280" x2="1200" y2="280"/>
    <line x1="0" y1="420" x2="1200" y2="420"/>
    <line x1="0" y1="560" x2="1200" y2="560"/>
    <line x1="300" y1="0" x2="300" y2="630"/>
    <line x1="600" y1="0" x2="600" y2="630"/>
    <line x1="900" y1="0" x2="900" y2="630"/>
  </g>

  <!-- Chart Card on Right -->
  <rect x="645" y="130" width="495" height="390" rx="28" fill="#0F172A" fill-opacity="0.82" stroke="#1E293B" stroke-width="2"/>
  <path d="${areaPath}" fill="url(#areaGrad)"/>
  <path d="${linePath}" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Ticker & Price Header inside Chart Card -->
  <rect x="675" y="160" width="118" height="36" rx="10" fill="#1E293B"/>
  <text x="734" y="183" text-anchor="middle" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="16" font-weight="800" fill="#F8FAFC">${escapeXml(spec.ticker)}</text>

  <text x="1110" y="182" text-anchor="end" font-family="monospace" font-size="22" font-weight="800" fill="#FFFFFF">${escapeXml(spec.priceText)}</text>
  <rect x="1008" y="196" width="102" height="30" rx="8" fill="${accentGlow}" fill-opacity="0.22"/>
  <text x="1059" y="216" text-anchor="middle" font-family="monospace" font-size="15" font-weight="800" fill="${accent}">${escapeXml(spec.changeText)}</text>

  <!-- Kicker Pill -->
  <rect x="70" y="88" width="330" height="34" rx="17" fill="#10B981" fill-opacity="0.14" stroke="#10B981" stroke-opacity="0.4"/>
  <circle cx="92" cy="105" r="5" fill="#10B981"/>
  <text x="108" y="110" font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="12" font-weight="800" letter-spacing="1.4" fill="#34D399">${escapeXml(spec.kicker.slice(0, 34))}</text>

  <!-- Main Headline -->
  <g font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="44" font-weight="900" fill="#FFFFFF">
    ${headlineLines
      .map((line, i) => `<text x="70" y="${202 + i * 56}">${escapeXml(line)}</text>`)
      .join('\n    ')}
  </g>

  <!-- Subtitle -->
  <g font-family="system-ui, -apple-system, Segoe UI, sans-serif" font-size="20" font-weight="500" fill="#94A3B8">
    ${subtitleLines
      .map((line, i) => `<text x="70" y="${400 + i * 30}">${escapeXml(line)}</text>`)
      .join('\n    ')}
  </g>

  <!-- Footer Brand Watermark -->
  <rect x="70" y="516" width="38" height="38" rx="10" fill="#6366F1"/>
  <text x="89" y="542" text-anchor="middle" font-family="system-ui, sans-serif" font-size="22" font-weight="900" fill="#FFFFFF">A</text>
  <text x="122" y="534" font-family="system-ui, sans-serif" font-size="18" font-weight="800" fill="#F8FAFC">Avora Bank Research</text>
  <text x="122" y="553" font-family="system-ui, sans-serif" font-size="12" font-weight="600" fill="#64748B">AUTOMATED MARKET INTELLIGENCE • ${escapeXml(slug.slice(0, 30))}</text>
</svg>`;
  }

  /**
   * Render witty vector Meme SVG card
   */
  renderMemeSvg(memeJson?: string | null, fallbackTicker = 'MARKET'): string {
    let spec: MemeSpec = {
      template: 'stonks',
      topText: `LOOKING AT ${fallbackTicker} CHARTS`,
      bottomText: 'TRUST THE RESEARCH THESIS',
      ticker: fallbackTicker,
      changeText: '+0.00%',
    };
    try {
      if (memeJson) spec = { ...spec, ...JSON.parse(memeJson) };
    } catch {}

    const topLines = wrapText(spec.topText.toUpperCase(), 26, 2);
    const botLines = wrapText(spec.bottomText.toUpperCase(), 26, 2);

    const isNeg = spec.changeText.startsWith('-');
    const accent = isNeg ? '#FB7185' : '#34D399';
    const chartPath = isNeg
      ? 'M 80 420 L 220 350 L 340 410 L 520 290 L 660 440 L 820 340'
      : 'M 80 480 L 220 430 L 360 450 L 510 310 L 670 335 L 830 165';

    const centerIllustration =
      spec.template === 'two-buttons'
        ? `
      <!-- Two Glowing Decision Buttons -->
      <rect x="145" y="185" width="265" height="140" rx="22" fill="#1E293B" stroke="#475569" stroke-width="3"/>
      <ellipse cx="277" cy="245" rx="68" ry="28" fill="#EF4444"/>
      <text x="277" y="298" text-anchor="middle" font-family="system-ui, sans-serif" font-size="17" font-weight="800" fill="#F8FAFC">BUY MORE ${escapeXml(spec.ticker)}</text>

      <rect x="490" y="185" width="265" height="140" rx="22" fill="#1E293B" stroke="#475569" stroke-width="3"/>
      <ellipse cx="622" cy="245" rx="68" ry="28" fill="#10B981"/>
      <text x="622" y="298" text-anchor="middle" font-family="system-ui, sans-serif" font-size="17" font-weight="800" fill="#F8FAFC">HOLD FOR EARNINGS</text>

      <!-- Sweating Trader Emoji Face -->
      <circle cx="450" cy="435" r="70" fill="#FBBF24"/>
      <circle cx="426" cy="422" r="7" fill="#0F172A"/>
      <circle cx="474" cy="422" r="7" fill="#0F172A"/>
      <path d="M 424 462 Q 450 448 476 462" fill="none" stroke="#0F172A" stroke-width="5" stroke-linecap="round"/>
      <path d="M 505 390 Q 520 415 505 430 Q 490 415 505 390 Z" fill="#38BDF8"/>
    `
        : `
      <!-- Live Meme Chart Backdrop -->
      <path d="${chartPath}" fill="none" stroke="${accent}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>
      <polygon points="830,155 800,175 825,198" fill="${accent}" opacity="${isNeg ? '0' : '1'}"/>

      <!-- Stylized "Analyst in Suit" Stonks Figure -->
      <circle cx="295" cy="295" r="68" fill="#E2E8F0"/>
      <circle cx="272" cy="285" r="6" fill="#0F172A"/>
      <circle cx="318" cy="285" r="6" fill="#0F172A"/>
      <path d="M 278 320 L 312 320" stroke="#0F172A" stroke-width="4" stroke-linecap="round"/>
      <!-- Suit Jacket & Tie -->
      <path d="M 185 520 C 185 410, 405 410, 405 520 Z" fill="#1E293B"/>
      <polygon points="295,380 278,430 295,485 312,430" fill="#10B981"/>
      <!-- Ticker Badge -->
      <rect x="520" y="230" width="250" height="86" rx="18" fill="#0F172A" fill-opacity="0.9" stroke="${accent}" stroke-width="2.5"/>
      <text x="645" y="268" text-anchor="middle" font-family="monospace" font-size="24" font-weight="900" fill="#FFFFFF">${escapeXml(spec.ticker)}</text>
      <text x="645" y="298" text-anchor="middle" font-family="monospace" font-size="20" font-weight="800" fill="${accent}">${escapeXml(spec.changeText)} TODAY</text>
    `;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="620" viewBox="0 0 900 620">
  <defs>
    <linearGradient id="mbg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#090D16"/>
      <stop offset="100%" stop-color="#111827"/>
    </linearGradient>
  </defs>
  <rect width="900" height="620" rx="24" fill="url(#mbg)"/>

  ${centerIllustration}

  <!-- Top Meme Caption Banner -->
  <rect x="30" y="24" width="840" height="106" rx="16" fill="#000000" fill-opacity="0.58"/>
  <g font-family="Impact, 'Arial Black', system-ui, sans-serif" font-size="36" font-weight="900" text-anchor="middle" fill="#FFFFFF" stroke="#000000" stroke-width="2" paint-order="stroke">
    ${topLines.map((l, i) => `<text x="450" y="${68 + i * 42}">${escapeXml(l)}</text>`).join('\n    ')}
  </g>

  <!-- Bottom Meme Caption Banner -->
  <rect x="30" y="485" width="840" height="108" rx="16" fill="#000000" fill-opacity="0.65"/>
  <g font-family="Impact, 'Arial Black', system-ui, sans-serif" font-size="36" font-weight="900" text-anchor="middle" fill="#FFFFFF" stroke="#000000" stroke-width="2" paint-order="stroke">
    ${botLines.map((l, i) => `<text x="450" y="${532 + i * 42}">${escapeXml(l)}</text>`).join('\n    ')}
  </g>

  <text x="860" y="608" text-anchor="end" font-family="system-ui, sans-serif" font-size="11" font-weight="700" fill="#64748B">@AvoraBankMarkets • Auto-Generated Market Humor</text>
</svg>`;
  }
}

export const autoContentService = new AutoContentService();
