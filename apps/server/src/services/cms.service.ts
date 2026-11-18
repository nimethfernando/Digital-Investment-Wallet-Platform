import { InquiryType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { notificationService } from '../adapters/notification/notification.provider';
import { autoContentService } from './autoContent.service';

export const PUBLIC_PLATFORM_CONFIG_DEFAULTS: Record<string, string> = {
  package_monthly_return_rate: '0.0100',
  package_lock_in_months: '6',
  package_min_amount: '1000',
  package_max_amount: '10000',
  package_early_exit_penalty_pct: '5.00',
  payout_day_of_month: '1',
  withdrawal_processing_days: '15',
  withdrawal_window_day: '1',
  withdrawal_fee_percent: '0.0',
  withdrawal_fx_spread_percent: '0.0',
  razorpay_commission_percent: '5.0',
  razorpay_gateway_fee_percent: '3.0',
  remittance_fee_percent: '3.0',
  remittance_margin_percent: '2.0',
  show_remittance_spread_controls: 'false',
  remittance_corridors_count: '7',
  remittance_countries_count: '110+',
  remittance_delivery_days: '2',
  startup_allocation_fee_percent: '5.0',
  startup_profit_share_percent: '5.0',
  startup_min_investment_usd: '250',
  otc_spread_percent: '1.0',
  otc_operator_fee_percent: '1.5',
  otc_platform_fee_percent: '0.5',
  otc_security_deposit_usd: '1000',
  p2p_security_deposit_usd: '50',
  p2p_daily_limit_usd: '5000',
  p2p_fee_percent: '0.0',
  virtual_card_issuance_fee: '10.00',
};

const SECRET_SETTING_KEYS = new Set([
  'razorpay_key_secret',
  'razorpay_webhook_secret',
  'ai_openai_api_key',
  'ai_gemini_api_key',
  'ai_finnhub_api_key',
  'ai_alphavantage_api_key',
]);

export const BLOG_TEMPLATE_TOKENS_CATALOG: Array<{
  token: string;
  key: string;
  label: string;
  group: string;
}> = [
  { token: '{{fx_margin}}', key: 'fx_margin', label: 'Remittance FX Margin (%)', group: 'Remittance' },
  { token: '{{transfer_fee}}', key: 'transfer_fee', label: 'Remittance Transfer Fee (%)', group: 'Remittance' },
  { token: '{{corridors_count}}', key: 'corridors_count', label: 'Primary Remittance Corridors', group: 'Remittance' },
  { token: '{{countries_count}}', key: 'countries_count', label: 'Supported Destination Countries', group: 'Remittance' },
  { token: '{{delivery_days}}', key: 'delivery_days', label: 'Remittance Delivery Days', group: 'Remittance' },
  { token: '{{fee_model_slash}}', key: 'fee_model_slash', label: 'Startup Fee Split (e.g. 5/5)', group: 'Venture Equity' },
  { token: '{{allocation_fee}}', key: 'allocation_fee', label: 'Startup Allocation Fee (%)', group: 'Venture Equity' },
  { token: '{{profit_share_fee}}', key: 'profit_share_fee', label: 'Startup Exit Profit Share (%)', group: 'Venture Equity' },
  { token: '{{startup_min_investment}}', key: 'startup_min_investment', label: 'Startup Minimum Investment ($)', group: 'Venture Equity' },
  { token: '{{monthly_return}}', key: 'monthly_return', label: 'FD Monthly Yield (%)', group: 'Fixed Deposits' },
  { token: '{{monthly_return_decimal}}', key: 'monthly_return_decimal', label: 'FD Monthly Yield (1.0%)', group: 'Fixed Deposits' },
  { token: '{{lock_in_months}}', key: 'lock_in_months', label: 'FD Lock-In Tenure (Months)', group: 'Fixed Deposits' },
  { token: '{{package_min}}', key: 'package_min', label: 'Min Package Size ($)', group: 'Fixed Deposits' },
  { token: '{{package_max}}', key: 'package_max', label: 'Max Package Size ($)', group: 'Fixed Deposits' },
  { token: '{{payout_day}}', key: 'payout_day', label: 'Monthly Yield / Window Day', group: 'Fixed Deposits' },
  { token: '{{withdrawal_processing_days}}', key: 'withdrawal_processing_days', label: 'Withdrawal Queue (Days)', group: 'Withdrawals' },
  { token: '{{withdrawal_fee}}', key: 'withdrawal_fee', label: 'Withdrawal Fee (%)', group: 'Withdrawals' },
  { token: '{{withdrawal_fx_spread}}', key: 'withdrawal_fx_spread', label: 'Withdrawal FX Spread (%)', group: 'Withdrawals' },
  { token: '{{otc_total_fee}}', key: 'otc_total_fee', label: 'OTC Total Commission (%)', group: 'OTC & P2P' },
  { token: '{{otc_broker_fee}}', key: 'otc_broker_fee', label: 'OTC Broker Share (%)', group: 'OTC & P2P' },
  { token: '{{otc_platform_fee}}', key: 'otc_platform_fee', label: 'OTC Platform Share (%)', group: 'OTC & P2P' },
  { token: '{{otc_spread}}', key: 'otc_spread', label: 'OTC Benchmark Spread (%)', group: 'OTC & P2P' },
  { token: '{{otc_deposit}}', key: 'otc_deposit', label: 'OTC Desk Security Deposit ($)', group: 'OTC & P2P' },
  { token: '{{p2p_deposit}}', key: 'p2p_deposit', label: 'P2P Merchant Deposit ($)', group: 'OTC & P2P' },
  { token: '{{p2p_daily_limit}}', key: 'p2p_daily_limit', label: 'P2P 24h Transfer Limit ($)', group: 'OTC & P2P' },
  { token: '{{card_issuance_fee}}', key: 'card_issuance_fee', label: 'Virtual Card Fee ($)', group: 'Cards & Payments' },
  { token: '{{razorpay_fee}}', key: 'razorpay_fee', label: 'Razorpay Total Fee (%)', group: 'Cards & Payments' },
];

export interface BlogPostWriteInput {
  title?: string;
  slug?: string;
  summary?: string;
  excerpt?: string;
  content?: string | string[];
  coverImage?: string | null;
  category?: string;
  tags?: string | string[] | null;
  keyTakeaways?: string | string[] | null;
  authorName?: string;
  authorRole?: string | null;
  readTime?: string;
  publishedAt?: string | Date;
  isPublished?: boolean;
  isFeatured?: boolean;
  autoTrackNews?: boolean;
  ticker?: string | null;
}

const DEFAULT_INSTITUTIONAL_POSTS = [
  {
    slug: 'immutable-double-entry-ledger-architecture-digital-banking',
    title: 'Why Immutable Double-Entry Ledger Architecture Is the Gold Standard for Digital Private Banking',
    summary:
      'An architectural deep-dive into how Avora Bank enforces cryptographic double-entry accounting across multi-currency wallets, investment packages, and escrow vaults with zero reliance on fragile third-party balance APIs.',
    category: 'Ledger Security',
    readTime: '6 min read',
    publishedAt: new Date('2026-10-24T09:00:00.000Z'),
    authorName: 'Dr. Viktor Kovalenko',
    authorRole: 'Chief Ledger Architect, Avora Bank',
    coverImage: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80',
    isFeatured: true,
    tags: 'Double-Entry Ledger, Zero-Trust Banking, Treasury Security, Auditability',
    keyTakeaways: JSON.stringify([
      'Every transaction generates balanced debit and credit journal entries inside ACID-compliant database transactions.',
      'Balances are never mutated in isolation; every movement records before-and-after snapshots with cryptographic idempotency keys.',
      'Segregated sub-ledgers isolate available liquidity, locked {{lock_in_months}}-month investment principal, and P2P/OTC escrow reserves.',
    ]),
    content: [
      'Modern fintech platforms frequently fail when they treat user balances as simple mutable numbers in a database table. Without strict double-entry constraints, race conditions, webhook retries, or partial network failures can silently create or destroy funds.',
      'At Avora Bank, our core engine is built from the ground up as a self-hosted, institutional double-entry ledger. Every financial event—whether a {{package_max}} package subscription, a {{monthly_return_decimal}} monthly yield distribution, an OTC settlement in Tbilisi, or a cross-border remittance to India—is recorded as an atomic journal entry where total debits strictly equal total credits.',
      'Each user wallet maintains three segregated balance states per currency (USD, USDT, EUR, INR, GEL): Available Balance, Locked Principal, and Pending Settlement. When a client subscribes to a {{lock_in_months}}-month fixed-term package, capital transitions atomically from Available Balance to Locked Principal with a unique Package Reference ID.',
      'On the {{payout_day}} of every calendar month, our automated treasury scheduler calculates the {{monthly_return_decimal}} target yield across active packages and credits the investor’s internal wallet via verified treasury distribution journals—providing complete auditability from genesis to settlement.',
    ].join('\n\n'),
  },
  {
    slug: 'cross-border-remittance-corridors-fx-transparency',
    title: 'Re-Engineering Cross-Border Remittance: Transparent FX Margins Across {{corridors_count}} Global Corridors',
    summary:
      'How Avora Bank eliminates hidden correspondent banking spreads by combining live mid-market reference feeds with a disclosed {{fx_margin}} exchange-rate margin and {{transfer_fee}} transfer fee across {{countries_count}} destinations.',
    category: 'Global Remittance',
    readTime: '5 min read',
    publishedAt: new Date('2026-10-20T09:00:00.000Z'),
    authorName: 'Elena Rostova',
    authorRole: 'Head of Global Settlement & FX Corridors',
    coverImage: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=80',
    isFeatured: false,
    tags: 'Global Transfer, FX Corridors, SWIFT & SEPA, Cross-Border Payments',
    keyTakeaways: JSON.stringify([
      'Upfront quote calculation discloses the exact reference rate, {{fx_margin_decimal}} FX adjustment, and {{transfer_fee_decimal}} transfer fee before confirmation.',
      'Real-time 5-stage milestone tracking from compliance screening to partner bank settlement within {{delivery_days}} business days.',
      'Direct local clearing support across India (INR), Sri Lanka (LKR), UAE (AED), Georgia (GEL), EU (SEPA), UK (Faster Payments), US (SWIFT/Fedwire), and {{countries_count}} countries worldwide.',
    ]),
    content: [
      'Traditional international wire transfers subject customers to opaque correspondent bank deductions and undisclosed exchange rate markups that often exceed 6% to 8% of the principal amount, with recipients receiving less than expected days later.',
      'Avora Bank’s Global Money Transfer service introduces institutional transparency to cross-border remittance. Before a client commits funds, our pricing engine locks a live quote displaying the exact benchmark rate, our configured {{fx_margin}} currency conversion margin, and the {{transfer_fee}} transfer fee.',
      'Once funded from the client’s Avora wallet, the transfer progresses through five auditable stages: Submitted, Compliance Screened, Conversion Locked, Partner Processing, and Completed. Clients can monitor every milestone in real time with standard delivery completed within {{delivery_days}} business days.',
    ].join('\n\n'),
  },
  {
    slug: 'startengine-style-venture-equity-nominee-crowdfunding',
    title: 'Democratizing Venture Capital: Inside Avora’s Nominee Equity Marketplace & {{fee_model_slash}} Fee Model',
    summary:
      'Explore how Avora Investments enables private banking clients to allocate capital into vetted AI, CleanTech, and Fintech startups from {{startup_min_investment}} using a clean single-line cap-table nominee structure.',
    category: 'Venture Equity',
    readTime: '7 min read',
    publishedAt: new Date('2026-10-16T09:00:00.000Z'),
    authorName: 'Marcus Vance',
    authorRole: 'Managing Director, Avora Venture Desk',
    coverImage: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
    isFeatured: false,
    tags: 'Startup Equity, Venture Capital, Crowdfunding, Nominee Structure',
    keyTakeaways: JSON.stringify([
      'Minimum investments starting at {{startup_min_investment}} into institutional-grade seed and Series A rounds via SAFE, Preferred Equity, and Convertible Notes.',
      'Transparent {{allocation_fee}} allocation fee at commitment and {{profit_share_fee}} profit-sharing fee strictly on net realized exit proceeds.',
      'Zero management fees on unrealized paper valuation markups.',
    ]),
    content: [
      'Historically, high-growth early-stage venture deals in AI infrastructure, clean energy, and cross-border fintech were restricted to institutional funds writing $250,000+ checks, while founders avoided retail crowdfunding due to messy cap tables.',
      'Avora Investments solves both sides of the market using the proven StartEngine/Seedrs nominee custody model. Avora holds a single consolidated legal line on the startup’s cap table while recording each investor’s beneficial equity entitlement inside our immutable ledger.',
      'Our alignment with investors is reinforced by our {{fee_model_slash}} pricing structure: a {{allocation_fee}} Investment Allocation Fee added on committed capital and a {{profit_share_fee}} Profit-Sharing Fee charged exclusively when real cash exits or dividends are distributed above original principal.',
    ].join('\n\n'),
  },
  {
    slug: 'location-based-otc-liquidity-desks-p2p-security-deposits',
    title: 'Location-Based OTC Desks & Security Deposit Escrow: Building Trust in Local Crypto-Fiat Settlement',
    summary:
      'How Avora Bank combines a physical cash counter in Tbilisi with a global network of {{otc_deposit}}-bonded OTC desk operators and {{p2p_deposit}}-bonded P2P market makers.',
    category: 'OTC & P2P Liquidity',
    readTime: '6 min read',
    publishedAt: new Date('2026-10-11T09:00:00.000Z'),
    authorName: 'Giorgi Beridze',
    authorRole: 'Head of Tbilisi OTC Operations',
    coverImage: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
    isFeatured: false,
    tags: 'OTC Desk, Tbilisi Counter, P2P Marketplace, Escrow Security',
    keyTakeaways: JSON.stringify([
      'Eligible operators stake a {{otc_deposit}} security deposit to operate regional OTC desks in cities like Colombo, Dubai, and Tbilisi.',
      '{{otc_total_fee}} transparent total commission split: {{otc_broker_fee}} earned by the local OTC operator and {{otc_platform_fee}} allocated to Avora Bank.',
      'Physical cash pickup and settlement available daily until 21:00 GCC time at our Freedom Square / Chavchavadze counter in Tbilisi.',
    ]),
    content: [
      'High-net-worth individuals and corporate treasuries frequently require reliable local settlement between USDT and regional fiat currencies without the counterparty risk of unregulated peer-to-peer chat groups.',
      'Avora Bank’s Global OTC Desk Marketplace establishes an accountable, location-based network of independent liquidity operators. Every OTC desk operator is required to lock a {{otc_deposit}} security deposit (and {{p2p_deposit}} for P2P marketplace participants) as collateral against settlement defaults.',
      'Customers can filter online desks by country and city, negotiate live exchange quotes through our monitored platform chat, and settle with complete peace of mind backed by automated completion-rate tracking and compliance oversight.',
    ].join('\n\n'),
  },
  {
    slug: 'avora-token-avr-testnet-faucet-mainnet-2027-roadmap',
    title: 'Avora Token ($AVR): Sepolia L2 Testnet Architecture, Early-Access Whitelist & Q4 2027 Mainnet',
    summary:
      'A comprehensive guide to testing ecosystem utility with the free $AVR Testnet Faucet, participating in the $1.00 reference Early-Access Registry, and our regulatory compliance framework.',
    category: 'Tokenomics',
    readTime: '5 min read',
    publishedAt: new Date('2026-10-05T09:00:00.000Z'),
    authorName: 'Dr. Viktor Kovalenko',
    authorRole: 'Chief Ledger Architect, Avora Bank',
    coverImage: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=1200&q=80',
    isFeatured: false,
    tags: 'Avora Token, $AVR, Testnet Faucet, Mainnet 2027',
    keyTakeaways: JSON.stringify([
      'Fixed 1,000,000,000 AVR total supply designed for fee rebates, OTC operator staking, and governance.',
      'Strict separation between $0-value Testnet Faucet tokens (100 AVR/24h) and the $1.00 Early-Access Whitelist Registry.',
      'Phased rollout culminating in full Layer-2 Mainnet deployment targeted for Q4 2027.',
    ]),
    content: [
      'The Avora Token ($AVR) is engineered to serve as the utility and settlement backbone of the Avora Bank ecosystem, powering transfer fee discounts, OTC desk collateral boosts, and governance participation.',
      'Currently live on the Avora Sepolia L2 Testnet, verified users can claim 100 testnet AVR every 24 hours via our integrated faucet to explore smart-contract interactions and ledger settlements—with clear disclosures that testnet tokens carry zero monetary value.',
      'Ahead of our targeted Q4 2027 Mainnet launch, eligible clients can register their allocation interest on the Early-Access Whitelist at the proposed $1.00 USD reference price.',
    ].join('\n\n'),
  },
  {
    slug: 'fixed-term-digital-investment-packages-yield-generation',
    title: 'Inside Avora’s {{lock_in_months}}-Month Fixed-Term Investment Packages & Institutional Yield Strategy',
    summary:
      'How Avora Bank structures {{package_min}} to {{package_max}} capital packages with independent lock-in schedules, monthly {{payout_day}}-of-the-month yield distributions, and two-stage withdrawal queues.',
    category: 'Treasury & Yield',
    readTime: '6 min read',
    publishedAt: new Date('2026-09-28T09:00:00.000Z'),
    authorName: 'Elena Rostova',
    authorRole: 'Head of Global Settlement & FX Corridors',
    coverImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
    isFeatured: false,
    tags: 'Investment Packages, Monthly Yield, Treasury Management, Risk Disclosure',
    keyTakeaways: JSON.stringify([
      'Each package ({{package_min}}–{{package_max}}) receives a unique Package Code with an independent {{lock_in_months}}-month maturity clock.',
      'Target {{monthly_return_decimal}} monthly return is calculated on active principal and credited on the {{payout_day}} of every calendar month.',
      'Structured {{payout_day}}-of-month withdrawal window with a {{withdrawal_processing_days}}-day treasury settlement queue ensures institutional liquidity stability.',
    ]),
    content: [
      'Predictable wealth compounding requires disciplined liquidity management. Rather than pooling client deposits into opaque demand accounts, Avora Bank issues discrete, trackable Investment Packages ranging from {{package_min}} to {{package_max}} USD.',
      'Every package is assigned its own cryptographic Package ID, purchase timestamp, and {{lock_in_months}}-month maturity date. Treasury revenue is generated through delta-neutral market-making spreads, OTC desk settlement fees, and short-duration trade finance facilities.',
      'By aligning redemptions with a structured monthly window opening on the {{payout_day}} of each calendar month and a {{withdrawal_processing_days}}-day settlement queue, Avora Bank eliminates maturity mismatch while delivering consistent monthly distributions.',
    ].join('\n\n'),
  },
];

export class CmsService {
  private defaultPostsChecked = false;

  private slugify(raw: string): string {
    return raw
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 130);
  }

  private normalizeTags(tags?: string | string[] | null): string {
    if (!tags) return 'Avora Bank, Research';
    if (Array.isArray(tags)) {
      return tags
        .map((t) => String(t).replace(/^#/, '').trim())
        .filter(Boolean)
        .join(', ');
    }
    return String(tags)
      .split(',')
      .map((t) => t.replace(/^#/, '').trim())
      .filter(Boolean)
      .join(', ');
  }

  private normalizeKeyTakeaways(takeaways?: string | string[] | null): string | null {
    if (takeaways === undefined || takeaways === null) return null;
    if (Array.isArray(takeaways)) {
      const cleaned = takeaways.map((t) => String(t).trim()).filter(Boolean);
      return JSON.stringify(cleaned);
    }
    const raw = String(takeaways).trim();
    if (!raw) return JSON.stringify([]);
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return JSON.stringify(parsed.map((t) => String(t).trim()).filter(Boolean));
      }
    } catch {
      // treat as newline-separated list
    }
    const lines = raw
      .split(/\r?\n/)
      .map((l) => l.replace(/^[-*•]\s*/, '').trim())
      .filter(Boolean);
    return JSON.stringify(lines);
  }

  private normalizeContent(content?: string | string[]): string {
    if (!content) return '';
    if (Array.isArray(content)) {
      return content
        .map((p) => String(p).trim())
        .filter(Boolean)
        .join('\n\n');
    }
    return String(content)
      .replace(/\r\n/g, '\n')
      .trim();
  }

  private computeReadTime(content: string, provided?: string): string {
    if (provided && provided.trim()) return provided.trim();
    const words = content.trim().split(/\s+/).filter(Boolean).length;
    const mins = Math.max(1, Math.ceil(words / 200));
    return `${mins} min read`;
  }

  async ensureDefaultBlogPosts(forceRestoreMissing = false): Promise<number> {
    await autoContentService.ensureSchema();
    if (this.defaultPostsChecked && !forceRestoreMissing) return 0;

    try {
      if (!forceRestoreMissing) {
        const seededFlag = await prisma.cmsSetting.findUnique({
          where: { key: 'blog_posts_seeded_v1' },
        });
        if (seededFlag?.value === 'true') {
          this.defaultPostsChecked = true;
          return 0;
        }
      }

      let insertedCount = 0;
      for (const item of DEFAULT_INSTITUTIONAL_POSTS) {
        const existing = await prisma.blogPost.findUnique({
          where: { slug: item.slug },
          select: { id: true },
        });
        if (!existing) {
          await prisma.blogPost.create({
            data: {
              slug: item.slug,
              title: item.title,
              summary: item.summary,
              content: item.content,
              coverImage: item.coverImage,
              category: item.category,
              tags: item.tags,
              keyTakeaways: item.keyTakeaways,
              authorName: item.authorName,
              authorRole: item.authorRole,
              readTime: item.readTime,
              isFeatured: item.isFeatured,
              isPublished: true,
              autoTrackNews: false,
              publishedAt: item.publishedAt,
            },
          });
          insertedCount++;
        }
      }

      await prisma.cmsSetting.upsert({
        where: { key: 'blog_posts_seeded_v1' },
        update: { value: 'true' },
        create: {
          key: 'blog_posts_seeded_v1',
          value: 'true',
          group: 'CMS',
          description: 'Tracks whether foundational Institutional Research Papers have been seeded into diw_blog_posts',
        },
      });
      await this.migrateSeededArticlesToDynamicTokens(forceRestoreMissing);
      this.defaultPostsChecked = true;
      return insertedCount;
    } catch (err) {
      console.warn('[CmsService] ensureDefaultBlogPosts warning:', err);
      return 0;
    }
  }

  private formatOrdinal(dayNum: number): string {
    const n = Math.floor(dayNum);
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
    switch (n % 10) {
      case 1:
        return `${n}st`;
      case 2:
        return `${n}nd`;
      case 3:
        return `${n}rd`;
      default:
        return `${n}th`;
    }
  }

  private formatPercent(num: number, decimals?: number): string {
    if (!Number.isFinite(num)) return '0%';
    if (typeof decimals === 'number') {
      return `${num.toFixed(decimals)}%`;
    }
    const cleaned = Number(num.toFixed(4)).toString();
    return `${cleaned}%`;
  }

  private formatSlashNumber(num: number): string {
    if (!Number.isFinite(num)) return '0';
    return Number(num.toFixed(4)).toString();
  }

  private formatUsdAmount(num: number): string {
    if (!Number.isFinite(num)) return '$0';
    const hasFraction = Math.round(num * 100) % 100 !== 0;
    return `$${num.toLocaleString('en-US', {
      minimumFractionDigits: hasFraction ? 2 : 0,
      maximumFractionDigits: hasFraction ? 2 : 0,
    })}`;
  }

  async getPublicSettings() {
    const settings = await prisma.cmsSetting.findMany();
    const map: Record<string, string> = { ...PUBLIC_PLATFORM_CONFIG_DEFAULTS };
    for (const s of settings) {
      if (
        SECRET_SETTING_KEYS.has(s.key) ||
        s.key.startsWith('admin_2fa_') ||
        s.key.startsWith('notif_state_') ||
        s.key.endsWith('_secret') ||
        s.key.endsWith('_api_key')
      ) {
        continue;
      }
      map[s.key] = s.value;
    }
    return map;
  }

  async getPlatformTemplateVars(): Promise<Record<string, string>> {
    const cfg = await this.getPublicSettings();

    const fxMarginNum = parseFloat(cfg.remittance_margin_percent || '2.0');
    const transferFeeNum = parseFloat(cfg.remittance_fee_percent || '3.0');
    const allocFeeNum = parseFloat(cfg.startup_allocation_fee_percent || '5.0');
    const profitShareNum = parseFloat(cfg.startup_profit_share_percent || '5.0');
    const monthlyRateNum = parseFloat(cfg.package_monthly_return_rate || '0.01') * 100;
    const lockInMonthsNum = parseInt(cfg.package_lock_in_months || cfg.package_min_lockin_months || '6', 10);
    const pkgMinNum = parseFloat(cfg.package_min_amount || '1000');
    const pkgMaxNum = parseFloat(cfg.package_max_amount || '10000');
    const payoutDayNum = parseInt(cfg.payout_day_of_month || '1', 10);
    const withdrawalDayNum = parseInt(cfg.withdrawal_window_day || '1', 10);
    const withdrawalProcDaysNum = parseInt(cfg.withdrawal_processing_days || '15', 10);
    const withdrawalFeeNum = parseFloat(cfg.withdrawal_fee_percent || '0.0');
    const withdrawalFxSpreadNum = parseFloat(cfg.withdrawal_fx_spread_percent || '0.0');
    const otcOpNum = parseFloat(cfg.otc_operator_fee_percent || '1.5');
    const otcPlatNum = parseFloat(cfg.otc_platform_fee_percent || '0.5');
    const otcSpreadNum = parseFloat(cfg.otc_spread_percent || '1.0');
    const otcDepositNum = parseFloat(cfg.otc_security_deposit_usd || '1000');
    const p2pDepositNum = parseFloat(cfg.p2p_security_deposit_usd || '50');
    const p2pLimitNum = parseFloat(cfg.p2p_daily_limit_usd || '5000');
    const startupMinNum = parseFloat(cfg.startup_min_investment_usd || '250');
    const cardFeeNum = parseFloat(cfg.virtual_card_issuance_fee || '10');
    const rzpFeeNum = parseFloat(cfg.razorpay_commission_percent || '5.0');

    return {
      fx_margin: this.formatPercent(fxMarginNum),
      fx_margin_decimal: this.formatPercent(fxMarginNum, 1),
      transfer_fee: this.formatPercent(transferFeeNum),
      transfer_fee_decimal: this.formatPercent(transferFeeNum, 1),
      corridors_count: (cfg.remittance_corridors_count || '7').trim(),
      countries_count: (cfg.remittance_countries_count || '110+').trim(),
      delivery_days: (cfg.remittance_delivery_days || '2').trim(),
      allocation_fee: this.formatPercent(allocFeeNum),
      profit_share_fee: this.formatPercent(profitShareNum),
      fee_model_slash: `${this.formatSlashNumber(allocFeeNum)}/${this.formatSlashNumber(profitShareNum)}`,
      startup_min_investment: this.formatUsdAmount(startupMinNum),
      monthly_return: this.formatPercent(monthlyRateNum),
      monthly_return_decimal: this.formatPercent(monthlyRateNum, 1),
      lock_in_months: String(Number.isFinite(lockInMonthsNum) && lockInMonthsNum > 0 ? lockInMonthsNum : 6),
      package_min: this.formatUsdAmount(pkgMinNum),
      package_max: this.formatUsdAmount(pkgMaxNum),
      payout_day: this.formatOrdinal(Number.isFinite(payoutDayNum) ? payoutDayNum : 1),
      withdrawal_window_day: this.formatOrdinal(Number.isFinite(withdrawalDayNum) ? withdrawalDayNum : 1),
      withdrawal_processing_days: String(Number.isFinite(withdrawalProcDaysNum) ? withdrawalProcDaysNum : 15),
      withdrawal_fee: this.formatPercent(withdrawalFeeNum),
      withdrawal_fx_spread: this.formatPercent(withdrawalFxSpreadNum),
      otc_total_fee: this.formatPercent(otcOpNum + otcPlatNum, 1),
      otc_broker_fee: this.formatPercent(otcOpNum, 1),
      otc_platform_fee: this.formatPercent(otcPlatNum, 1),
      otc_spread: this.formatPercent(otcSpreadNum, 1),
      otc_deposit: this.formatUsdAmount(otcDepositNum),
      p2p_deposit: this.formatUsdAmount(p2pDepositNum),
      p2p_daily_limit: this.formatUsdAmount(p2pLimitNum),
      card_issuance_fee: this.formatUsdAmount(cardFeeNum),
      razorpay_fee: this.formatPercent(rzpFeeNum),
    };
  }

  getBlogTemplateTokensCatalog() {
    return BLOG_TEMPLATE_TOKENS_CATALOG;
  }

  private interpolateText(input: string, vars: Record<string, string>): string {
    if (!input || !input.includes('{{')) return input;
    return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
      return vars[key] !== undefined ? vars[key] : match;
    });
  }

  private resolveBlogPostFields<T extends { title: string; summary: string; content: string; keyTakeaways?: string | null; tags?: string | null }>(
    post: T,
    vars: Record<string, string>
  ): T {
    return {
      ...post,
      title: this.interpolateText(post.title, vars),
      summary: this.interpolateText(post.summary, vars),
      content: this.interpolateText(post.content, vars),
      keyTakeaways: post.keyTakeaways ? this.interpolateText(post.keyTakeaways, vars) : post.keyTakeaways,
      tags: post.tags ? this.interpolateText(post.tags, vars) : post.tags,
    };
  }

  async migrateSeededArticlesToDynamicTokens(force = false): Promise<number> {
    try {
      if (!force) {
        const done = await prisma.cmsSetting.findUnique({ where: { key: 'blog_posts_tokens_v2' } });
        if (done?.value === 'true') return 0;
      }

      const replacements: Array<[string, string]> = [
        ['Across 7 Global Corridors', 'Across {{corridors_count}} Global Corridors'],
        ['disclosed 2% exchange-rate margin and 3% transfer fee', 'disclosed {{fx_margin}} exchange-rate margin and {{transfer_fee}} transfer fee'],
        ['2.0% FX adjustment, and 3.0% transfer fee', '{{fx_margin_decimal}} FX adjustment, and {{transfer_fee_decimal}} transfer fee'],
        ['configured 2% currency conversion margin, and the 3% transfer fee', 'configured {{fx_margin}} currency conversion margin, and the {{transfer_fee}} transfer fee'],
        ['within 2 business days', 'within {{delivery_days}} business days'],
        ['within two business days', 'within {{delivery_days}} business days'],
        ['& 5/5 Fee Model', '& {{fee_model_slash}} Fee Model'],
        ['by our 5/5 pricing structure: a 5% Investment Allocation Fee on committed capital (meaning $950 of a $1,000 commitment goes directly into net startup allocation) and a 5% Profit-Sharing Fee', 'by our {{fee_model_slash}} pricing structure: a {{allocation_fee}} Investment Allocation Fee added on committed capital and a {{profit_share_fee}} Profit-Sharing Fee'],
        ['startups from $250', 'startups from {{startup_min_investment}}'],
        ['starting at $250', 'starting at {{startup_min_investment}}'],
        ['Transparent 5% allocation fee at commitment and 5% profit-sharing fee', 'Transparent {{allocation_fee}} allocation fee at commitment and {{profit_share_fee}} profit-sharing fee'],
        ['$1,000-bonded OTC desk operators and $50-bonded P2P', '{{otc_deposit}}-bonded OTC desk operators and {{p2p_deposit}}-bonded P2P'],
        ['stake a $1,000 security deposit', 'stake a {{otc_deposit}} security deposit'],
        ['lock a $1,000 security deposit (and $50 for P2P', 'lock a {{otc_deposit}} security deposit (and {{p2p_deposit}} for P2P'],
        ['1.5% transparent total commission split: 1.0% earned by the local OTC operator and 0.5% allocated to Avora Bank', '{{otc_total_fee}} transparent total commission split: {{otc_broker_fee}} earned by the local OTC operator and {{otc_platform_fee}} allocated to Avora Bank'],
        ['Avora’s 6-Month Fixed-Term', 'Avora’s {{lock_in_months}}-Month Fixed-Term'],
        ['structures $1,000 to $10,000 capital packages with independent lock-in schedules, monthly 1st-of-the-month yield', 'structures {{package_min}} to {{package_max}} capital packages with independent lock-in schedules, monthly {{payout_day}}-of-the-month yield'],
        ['($1,000–$10,000) receives a unique Package Code with an independent 6-month maturity', '({{package_min}}–{{package_max}}) receives a unique Package Code with an independent {{lock_in_months}}-month maturity'],
        ['Target 1.0% monthly return is calculated on active principal and credited on the 1st of every calendar month.', 'Target {{monthly_return_decimal}} monthly return is calculated on active principal and credited on the {{payout_day}} of every calendar month.'],
        ['Structured 1st-of-month withdrawal window with a 15-day treasury settlement', 'Structured {{payout_day}}-of-month withdrawal window with a {{withdrawal_processing_days}}-day treasury settlement'],
        ['ranging from $1,000 to $10,000 USD', 'ranging from {{package_min}} to {{package_max}} USD'],
        ['and 6-month maturity date', 'and {{lock_in_months}}-month maturity date'],
        ['opening on the 1st of each calendar month and a 15-day settlement queue', 'opening on the {{payout_day}} of each calendar month and a {{withdrawal_processing_days}}-day settlement queue'],
        ['locked 6-month investment principal', 'locked {{lock_in_months}}-month investment principal'],
        ['whether a $10,000 package subscription, a 1.0% monthly yield distribution', 'whether a {{package_max}} package subscription, a {{monthly_return_decimal}} monthly yield distribution'],
        ['subscribes to a 6-month fixed-term package', 'subscribes to a {{lock_in_months}}-month fixed-term package'],
        ['On the 1st of every calendar month, our automated treasury scheduler calculates the 1.0% target yield', 'On the {{payout_day}} of every calendar month, our automated treasury scheduler calculates the {{monthly_return_decimal}} target yield'],
      ];

      const applyReplacements = (txt: string | null) => {
        if (!txt) return txt;
        let out = txt;
        for (const [literal, token] of replacements) {
          out = out.split(literal).join(token);
        }
        return out;
      };

      const seededSlugs = DEFAULT_INSTITUTIONAL_POSTS.map((p) => p.slug);
      const existingRows = await prisma.blogPost.findMany({
        where: { slug: { in: seededSlugs } },
      });

      let updatedCount = 0;
      for (const row of existingRows) {
        const nextTitle = applyReplacements(row.title) || row.title;
        const nextSummary = applyReplacements(row.summary) || row.summary;
        const nextContent = applyReplacements(row.content) || row.content;
        const nextTakeaways = applyReplacements(row.keyTakeaways);
        if (
          nextTitle !== row.title ||
          nextSummary !== row.summary ||
          nextContent !== row.content ||
          nextTakeaways !== row.keyTakeaways
        ) {
          await prisma.blogPost.update({
            where: { id: row.id },
            data: {
              title: nextTitle,
              summary: nextSummary,
              content: nextContent,
              keyTakeaways: nextTakeaways,
            },
          });
          updatedCount++;
        }
      }

      await prisma.cmsSetting.upsert({
        where: { key: 'blog_posts_tokens_v2' },
        update: { value: 'true' },
        create: {
          key: 'blog_posts_tokens_v2',
          value: 'true',
          group: 'CMS',
          description: 'Tracks migration of seeded research papers to dynamic {{variable}} tokens',
        },
      });
      return updatedCount;
    } catch (err) {
      console.warn('[CmsService] migrateSeededArticlesToDynamicTokens warning:', err);
      return 0;
    }
  }

  async updateSetting(key: string, value: string, group = 'GENERAL') {
    return prisma.cmsSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value, group },
    });
  }

  async getPageSections(page: string) {
    return prisma.cmsSection.findMany({
      where: { page: page.toUpperCase(), isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getAllSections() {
    return prisma.cmsSection.findMany({
      orderBy: [{ page: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async updateSection(id: string, data: { title?: string; subtitle?: string; content?: string; metadata?: string; isActive?: boolean }) {
    return prisma.cmsSection.update({
      where: { id },
      data,
    });
  }

  async getBlogPosts(includeDrafts = false) {
    await this.ensureDefaultBlogPosts();
    const posts = await prisma.blogPost.findMany({
      where: includeDrafts ? {} : { isPublished: true },
      orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
      include: {
        _count: {
          select: { newsUpdates: true },
        },
      },
    });
    if (includeDrafts) {
      // Admin CMS receives raw editable fields (preserving {{...}} tokens)
      return posts;
    }
    const vars = await this.getPlatformTemplateVars();
    return posts.map((p) => this.resolveBlogPostFields(p, vars));
  }

  async getBlogPostBySlug(slug: string, includeDrafts = false, raw = false) {
    await this.ensureDefaultBlogPosts();
    const post = await prisma.blogPost.findUnique({
      where: { slug },
      include: {
        newsUpdates: {
          orderBy: { publishedAt: 'desc' },
          take: 25,
        },
      },
    });
    if (!post) return null;
    if (!includeDrafts && !post.isPublished) return null;
    if (raw) return post;
    const vars = await this.getPlatformTemplateVars();
    return this.resolveBlogPostFields(post, vars);
  }

  async createBlogPost(input: BlogPostWriteInput) {
    await this.ensureDefaultBlogPosts();

    const title = String(input.title || '').trim();
    if (!title) {
      throw new Error('Article title is required.');
    }

    const content = this.normalizeContent(input.content);
    if (!content) {
      throw new Error('Article body copy is required.');
    }

    let baseSlug = this.slugify(input.slug && input.slug.trim() ? input.slug : title);
    if (!baseSlug) {
      baseSlug = `research-paper-${Date.now()}`;
    }

    let slug = baseSlug;
    let suffix = 2;
    while (await prisma.blogPost.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${baseSlug}-${suffix}`;
      suffix++;
    }

    const summaryRaw = String(input.summary ?? input.excerpt ?? '').trim();
    const summary =
      summaryRaw ||
      content
        .replace(/^##\s+/gm, '')
        .split(/\n+/)
        .find((line) => line.trim().length > 20)
        ?.slice(0, 260) ||
      title;

    const category = String(input.category || 'Market Research').trim() || 'Market Research';
    const tags = this.normalizeTags(input.tags);
    const keyTakeaways = this.normalizeKeyTakeaways(input.keyTakeaways);
    const authorName = String(input.authorName || 'Avora Bank Research Team').trim() || 'Avora Bank Research Team';
    const authorRole =
      input.authorRole !== undefined && input.authorRole !== null && String(input.authorRole).trim()
        ? String(input.authorRole).trim()
        : 'Avora Bank Research Desk';
    const readTime = this.computeReadTime(content, input.readTime);

    let publishedAt = new Date();
    if (input.publishedAt) {
      const parsedDate = new Date(input.publishedAt);
      if (!isNaN(parsedDate.getTime())) {
        publishedAt = parsedDate;
      }
    }

    const isFeatured = Boolean(input.isFeatured);
    if (isFeatured) {
      await prisma.blogPost.updateMany({
        where: { isFeatured: true },
        data: { isFeatured: false },
      });
    }

    const isPublished = input.isPublished !== undefined ? Boolean(input.isPublished) : true;
    const ticker = input.ticker && String(input.ticker).trim() ? String(input.ticker).trim().toUpperCase() : null;
    const autoTrackNews = input.autoTrackNews !== undefined ? Boolean(input.autoTrackNews) : Boolean(ticker);
    const coverImage =
      input.coverImage && String(input.coverImage).trim()
        ? String(input.coverImage).trim()
        : 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80';

    return prisma.blogPost.create({
      data: {
        slug,
        title,
        summary,
        content,
        coverImage,
        category,
        tags,
        keyTakeaways,
        authorName,
        authorRole,
        readTime,
        publishedAt,
        isPublished,
        isFeatured,
        autoTrackNews,
        ticker,
      },
      include: {
        _count: {
          select: { newsUpdates: true },
        },
      },
    });
  }

  async updateBlogPost(id: string, input: BlogPostWriteInput) {
    await this.ensureDefaultBlogPosts();

    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) {
      throw new Error('Article not found.');
    }

    const data: Record<string, any> = {};

    if (input.title !== undefined) {
      const cleanTitle = String(input.title).trim();
      if (!cleanTitle) throw new Error('Article title cannot be empty.');
      data.title = cleanTitle;
    }

    if (input.slug !== undefined && String(input.slug).trim()) {
      const cleanSlug = this.slugify(String(input.slug));
      if (cleanSlug && cleanSlug !== existing.slug) {
        const collision = await prisma.blogPost.findUnique({
          where: { slug: cleanSlug },
          select: { id: true },
        });
        if (collision && collision.id !== id) {
          throw new Error(`Slug "${cleanSlug}" is already used by another article.`);
        }
        data.slug = cleanSlug;
      }
    }

    if (input.summary !== undefined || input.excerpt !== undefined) {
      data.summary = String(input.summary ?? input.excerpt ?? '').trim();
    }

    if (input.content !== undefined) {
      const cleanContent = this.normalizeContent(input.content);
      if (!cleanContent) throw new Error('Article body copy cannot be empty.');
      data.content = cleanContent;
      if (input.readTime === undefined) {
        data.readTime = this.computeReadTime(cleanContent, existing.readTime);
      }
    }

    if (input.readTime !== undefined) {
      data.readTime = this.computeReadTime(data.content || existing.content, input.readTime);
    }

    if (input.category !== undefined) {
      data.category = String(input.category).trim() || 'Market Research';
    }

    if (input.tags !== undefined) {
      data.tags = this.normalizeTags(input.tags);
    }

    if (input.keyTakeaways !== undefined) {
      data.keyTakeaways = this.normalizeKeyTakeaways(input.keyTakeaways);
    }

    if (input.authorName !== undefined) {
      data.authorName = String(input.authorName).trim() || 'Avora Bank Research Team';
    }

    if (input.authorRole !== undefined) {
      data.authorRole = input.authorRole && String(input.authorRole).trim() ? String(input.authorRole).trim() : null;
    }

    if (input.coverImage !== undefined) {
      data.coverImage = input.coverImage && String(input.coverImage).trim() ? String(input.coverImage).trim() : null;
    }

    if (input.publishedAt !== undefined && input.publishedAt !== null && String(input.publishedAt).trim() !== '') {
      const parsedDate = new Date(input.publishedAt);
      if (!isNaN(parsedDate.getTime())) {
        data.publishedAt = parsedDate;
      }
    }

    if (typeof input.isPublished === 'boolean') {
      data.isPublished = input.isPublished;
    }

    if (typeof input.isFeatured === 'boolean') {
      data.isFeatured = input.isFeatured;
      if (input.isFeatured) {
        await prisma.blogPost.updateMany({
          where: { id: { not: id }, isFeatured: true },
          data: { isFeatured: false },
        });
      }
    }

    if (typeof input.autoTrackNews === 'boolean') {
      data.autoTrackNews = input.autoTrackNews;
    }

    if (input.ticker !== undefined) {
      data.ticker = input.ticker && String(input.ticker).trim() ? String(input.ticker).trim().toUpperCase() : null;
    }

    return prisma.blogPost.update({
      where: { id },
      data,
      include: {
        _count: {
          select: { newsUpdates: true },
        },
      },
    });
  }

  async deleteBlogPost(id: string) {
    await this.ensureDefaultBlogPosts();
    return prisma.blogPost.delete({ where: { id } });
  }

  async submitInquiry(data: {
    type: InquiryType;
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
    userId?: string;
  }) {
    const inquiry = await prisma.inquiry.create({
      data: {
        type: data.type,
        name: data.name,
        email: data.email,
        phone: data.phone,
        subject: data.subject,
        message: data.message,
        userId: data.userId,
      },
    });

    notificationService.sendAdminAlert(
      `New Website Inquiry: ${data.subject} (${data.type})`,
      `From: ${data.name} (${data.email}, ${data.phone || 'No phone'})\n\nMessage:\n${data.message}`,
      { inquiryId: inquiry.id, type: data.type }
    ).catch(() => {});

    return inquiry;
  }

  async subscribeNewsletter(email: string) {
    const cleanEmail = email.toLowerCase().trim();

    // Check if already subscribed in Inquiries
    const existing = await prisma.inquiry.findFirst({
      where: { email: cleanEmail, subject: 'NEWSLETTER: Avora Financial Intelligence Briefing' },
    });

    if (!existing) {
      await prisma.inquiry.create({
        data: {
          type: InquiryType.GENERAL,
          name: 'Investor Subscriber',
          email: cleanEmail,
          subject: 'NEWSLETTER: Avora Financial Intelligence Briefing',
          message: 'Subscribed to weekly institutional yield reports, OTC liquidity desk announcements, and platform updates.',
          status: 'RESOLVED',
        },
      });
    }

    // Send confirmation welcome email
    notificationService.sendEmail({
      to: cleanEmail,
      subject: 'Welcome to the Avora Financial Intelligence Briefing',
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background: #090d16; color: #f8fafc; padding: 36px; border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.35); box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          <div style="border-bottom: 1px solid #1e293b; padding-bottom: 18px; margin-bottom: 24px;">
            <h1 style="color: #10b981; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">AVORA BANK</h1>
            <p style="color: #94a3b8; font-size: 11px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Institutional Intelligence &amp; Wealth</p>
          </div>
          
          <h2 style="color: #ffffff; font-size: 20px; font-weight: 800; margin-top: 0;">Subscription Confirmed</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
            Welcome to the <strong>Avora Financial Intelligence Briefing</strong>. You are now connected to our weekly institutional publication.
          </p>

          <div style="background: #0e1726; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <h3 style="color: #38bdf8; font-size: 13px; margin-top: 0; text-transform: uppercase; letter-spacing: 0.5px;">What You Will Receive Every Week:</h3>
            <ul style="color: #94a3b8; font-size: 13px; line-height: 1.8; padding-left: 20px; margin-bottom: 0;">
              <li>Monthly yield distribution metrics &amp; package performance reports</li>
              <li>Virtual Visa/Mastercard BaaS corridors &amp; spending limit upgrades</li>
              <li>Global OTC liquidity spreads across Dubai, Colombo, London &amp; SEPA rails</li>
              <li>Private client startup crowdfunding allocations &amp; secondary liquidity notes</li>
            </ul>
          </div>

          <p style="color: #64748b; font-size: 11px; line-height: 1.5; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 16px;">
            Avora Bank • Institutional Operations &amp; Global OTC Liquidity Rails.<br>
            Hotline: +995 555433091 | Telegram: @avorallc
          </p>
        </div>
      `,
    }).catch(() => {});

    // Alert admin
    notificationService.sendAdminAlert(
      'New Newsletter Subscriber',
      `Investor email: ${cleanEmail} subscribed to the Avora Financial Intelligence Briefing.`
    ).catch(() => {});

    return { success: true, message: 'Thank you for subscribing! A welcome confirmation has been sent to your email.' };
  }

  async getInquiries(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [inquiries, total] = await Promise.all([
      prisma.inquiry.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.inquiry.count(),
    ]);

    return { inquiries, total, page, totalPages: Math.ceil(total / limit) };
  }

  async updateInquiryStatus(id: string, status: string, adminNotes?: string) {
    return prisma.inquiry.update({
      where: { id },
      data: { status, adminNotes },
    });
  }

  async getUserInquiries(userId: string) {
    return prisma.inquiry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}

export const cmsService = new CmsService();
