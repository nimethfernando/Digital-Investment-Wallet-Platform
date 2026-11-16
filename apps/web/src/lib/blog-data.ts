export interface BlogPostItem {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  publishedAt: string;
  authorName: string;
  authorRole: string;
  coverImage: string;
  isFeatured?: boolean;
  tags: string[];
  content: string[];
  keyTakeaways: string[];
}

export const BLOG_POSTS_DATA: BlogPostItem[] = [
  {
    id: 'blog-1',
    slug: 'immutable-double-entry-ledger-architecture-digital-banking',
    title: 'Why Immutable Double-Entry Ledger Architecture Is the Gold Standard for Digital Private Banking',
    excerpt:
      'An architectural deep-dive into how Avora Bank enforces cryptographic double-entry accounting across multi-currency wallets, investment packages, and escrow vaults with zero reliance on fragile third-party balance APIs.',
    category: 'Ledger Security',
    readTime: '6 min read',
    publishedAt: '2026-10-24',
    authorName: 'Dr. Viktor Kovalenko',
    authorRole: 'Chief Ledger Architect, Avora Bank',
    coverImage: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80',
    isFeatured: true,
    tags: ['Double-Entry Ledger', 'Zero-Trust Banking', 'Treasury Security', 'Auditability'],
    keyTakeaways: [
      'Every transaction generates balanced debit and credit journal entries inside ACID-compliant database transactions.',
      'Balances are never mutated in isolation; every movement records before-and-after snapshots with cryptographic idempotency keys.',
      'Segregated sub-ledgers isolate available liquidity, locked 6-month investment principal, and P2P/OTC escrow reserves.',
    ],
    content: [
      'Modern fintech platforms frequently fail when they treat user balances as simple mutable numbers in a database table. Without strict double-entry constraints, race conditions, webhook retries, or partial network failures can silently create or destroy funds.',
      'At Avora Bank, our core engine is built from the ground up as a self-hosted, institutional double-entry ledger. Every financial event—whether a $10,000 package subscription, a 1.0% monthly yield distribution, an OTC settlement in Tbilisi, or a cross-border remittance to India—is recorded as an atomic journal entry where total debits strictly equal total credits.',
      'Each user wallet maintains three segregated balance states per currency (USD, USDT, EUR, INR, GEL): Available Balance, Locked Principal, and Pending Settlement. When a client subscribes to a 6-month fixed-term package, capital transitions atomically from Available Balance to Locked Principal with a unique Package Reference ID.',
      'On the 1st of every calendar month, our automated treasury scheduler calculates the 1.0% target yield across active packages and credits the investor’s internal wallet via verified treasury distribution journals—providing complete auditability from genesis to settlement.',
    ],
  },
  {
    id: 'blog-2',
    slug: 'cross-border-remittance-corridors-fx-transparency',
    title: 'Re-Engineering Cross-Border Remittance: Transparent FX Margins Across 7 Global Corridors',
    excerpt:
      'How Avora Bank eliminates hidden correspondent banking spreads by combining live mid-market reference feeds with a disclosed 2% exchange-rate margin and 3% transfer fee across India, Sri Lanka, UAE, Georgia, EU, UK, and US.',
    category: 'Global Remittance',
    readTime: '5 min read',
    publishedAt: '2026-10-20',
    authorName: 'Elena Rostova',
    authorRole: 'Head of Global Settlement & FX Corridors',
    coverImage: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=80',
    tags: ['Global Transfer', 'FX Corridors', 'SWIFT & SEPA', 'Cross-Border Payments'],
    keyTakeaways: [
      'Upfront quote calculation discloses the exact reference rate, 2.0% FX adjustment, and 3.0% transfer fee before confirmation.',
      'Real-time 5-stage milestone tracking from compliance screening to partner bank settlement within 2 business days.',
      'Direct local clearing support for INR (NEFT/IMPS), LKR, AED, GEL, EUR (SEPA), GBP (Faster Payments), and USD (Fedwire/SWIFT).',
    ],
    content: [
      'Traditional international wire transfers subject customers to opaque correspondent bank deductions and undisclosed exchange rate markups that often exceed 6% to 8% of the principal amount, with recipients receiving less than expected days later.',
      'Avora Bank’s Global Money Transfer service introduces institutional transparency to cross-border remittance. Before a client commits funds, our pricing engine locks a live quote displaying the exact benchmark rate, our configured 2% currency conversion margin, and the 3% transfer fee.',
      'Once funded from the client’s Avora wallet, the transfer progresses through five auditable stages: Submitted, Compliance Screened, Conversion Locked, Partner Processing, and Completed. Clients can monitor every milestone in real time with standard delivery completed within two business days.',
    ],
  },
  {
    id: 'blog-3',
    slug: 'startengine-style-venture-equity-nominee-crowdfunding',
    title: 'Democratizing Venture Capital: Inside Avora’s Nominee Equity Marketplace & 5/5 Fee Model',
    excerpt:
      'Explore how Avora Investments enables private banking clients to allocate capital into vetted AI, CleanTech, and Fintech startups from $250 using a clean single-line cap-table nominee structure.',
    category: 'Venture Equity',
    readTime: '7 min read',
    publishedAt: '2026-10-16',
    authorName: 'Marcus Vance',
    authorRole: 'Managing Director, Avora Venture Desk',
    coverImage: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
    tags: ['Startup Equity', 'Venture Capital', 'Crowdfunding', 'Nominee Structure'],
    keyTakeaways: [
      'Minimum investments starting at $250 into institutional-grade seed and Series A rounds via SAFE, Preferred Equity, and Convertible Notes.',
      'Transparent 5% allocation fee at commitment and 5% profit-sharing fee strictly on net realized exit proceeds.',
      'Zero management fees on unrealized paper valuation markups.',
    ],
    content: [
      'Historically, high-growth early-stage venture deals in AI infrastructure, clean energy, and cross-border fintech were restricted to institutional funds writing $250,000+ checks, while founders avoided retail crowdfunding due to messy cap tables.',
      'Avora Investments solves both sides of the market using the proven StartEngine/Seedrs nominee custody model. Avora holds a single consolidated legal line on the startup’s cap table while recording each investor’s beneficial equity entitlement inside our immutable ledger.',
      'Our alignment with investors is reinforced by our 5/5 pricing structure: a 5% Investment Allocation Fee on committed capital (meaning $950 of a $1,000 commitment goes directly into net startup allocation) and a 5% Profit-Sharing Fee charged exclusively when real cash exits or dividends are distributed above original principal.',
    ],
  },
  {
    id: 'blog-4',
    slug: 'location-based-otc-liquidity-desks-p2p-security-deposits',
    title: 'Location-Based OTC Desks & Security Deposit Escrow: Building Trust in Local Crypto-Fiat Settlement',
    excerpt:
      'How Avora Bank combines a physical cash counter in Tbilisi with a global network of $1,000-bonded OTC desk operators and $50-bonded P2P market makers.',
    category: 'OTC & P2P Liquidity',
    readTime: '6 min read',
    publishedAt: '2026-10-11',
    authorName: 'Giorgi Beridze',
    authorRole: 'Head of Tbilisi OTC Operations',
    coverImage: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
    tags: ['OTC Desk', 'Tbilisi Counter', 'P2P Marketplace', 'Escrow Security'],
    keyTakeaways: [
      'Eligible operators stake a $1,000 security deposit to operate regional OTC desks in cities like Colombo, Dubai, and Tbilisi.',
      '1.5% transparent total commission split: 1.0% earned by the local OTC operator and 0.5% allocated to Avora Bank.',
      'Physical cash pickup and settlement available daily until 21:00 GCC time at our Freedom Square / Chavchavadze counter in Tbilisi.',
    ],
    content: [
      'High-net-worth individuals and corporate treasuries frequently require reliable local settlement between USDT and regional fiat currencies without the counterparty risk of unregulated peer-to-peer chat groups.',
      'Avora Bank’s Global OTC Desk Marketplace establishes an accountable, location-based network of independent liquidity operators. Every OTC desk operator is required to lock a $1,000 security deposit (and $50 for P2P marketplace participants) as collateral against settlement defaults.',
      'Customers can filter online desks by country and city, negotiate live exchange quotes through our monitored platform chat, and settle with complete peace of mind backed by automated completion-rate tracking and compliance oversight.',
    ],
  },
  {
    id: 'blog-5',
    slug: 'avora-token-avr-testnet-faucet-mainnet-2027-roadmap',
    title: 'Avora Token ($AVR): Sepolia L2 Testnet Architecture, Early-Access Whitelist & Q4 2027 Mainnet',
    excerpt:
      'A comprehensive guide to testing ecosystem utility with the free $AVR Testnet Faucet, participating in the $1.00 reference Early-Access Registry, and our regulatory compliance framework.',
    category: 'Tokenomics',
    readTime: '5 min read',
    publishedAt: '2026-10-05',
    authorName: 'Dr. Viktor Kovalenko',
    authorRole: 'Chief Ledger Architect, Avora Bank',
    coverImage: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=1200&q=80',
    tags: ['Avora Token', '$AVR', 'Testnet Faucet', 'Mainnet 2027'],
    keyTakeaways: [
      'Fixed 1,000,000,000 AVR total supply designed for fee rebates, OTC operator staking, and governance.',
      'Strict separation between $0-value Testnet Faucet tokens (100 AVR/24h) and the $1.00 Early-Access Whitelist Registry.',
      'Phased rollout culminating in full Layer-2 Mainnet deployment targeted for Q4 2027.',
    ],
    content: [
      'The Avora Token ($AVR) is engineered to serve as the utility and settlement backbone of the Avora Bank ecosystem, powering transfer fee discounts, OTC desk collateral boosts, and governance participation.',
      'Currently live on the Avora Sepolia L2 Testnet, verified users can claim 100 testnet AVR every 24 hours via our integrated faucet to explore smart-contract interactions and ledger settlements—with clear disclosures that testnet tokens carry zero monetary value.',
      'Ahead of our targeted Q4 2027 Mainnet launch, eligible clients can register their allocation interest on the Early-Access Whitelist at the proposed $1.00 USD reference price.',
    ],
  },
  {
    id: 'blog-6',
    slug: 'fixed-term-digital-investment-packages-yield-generation',
    title: 'Inside Avora’s 6-Month Fixed-Term Investment Packages & Institutional Yield Strategy',
    excerpt:
      'How Avora Bank structures $1,000 to $10,000 capital packages with independent lock-in schedules, monthly 1st-of-the-month yield distributions, and two-stage withdrawal queues.',
    category: 'Treasury & Yield',
    readTime: '6 min read',
    publishedAt: '2026-09-28',
    authorName: 'Elena Rostova',
    authorRole: 'Head of Global Settlement & FX Corridors',
    coverImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
    tags: ['Investment Packages', 'Monthly Yield', 'Treasury Management', 'Risk Disclosure'],
    keyTakeaways: [
      'Each package ($1,000–$10,000) receives a unique Package Code with an independent 6-month maturity clock.',
      'Target 1.0% monthly return is calculated on active principal and credited on the 1st of every calendar month.',
      'Structured 1st-of-month withdrawal window with a 15-day treasury settlement queue ensures institutional liquidity stability.',
    ],
    content: [
      'Predictable wealth compounding requires disciplined liquidity management. Rather than pooling client deposits into opaque demand accounts, Avora Bank issues discrete, trackable Investment Packages ranging from $1,000 to $10,000 USD.',
      'Every package is assigned its own cryptographic Package ID, purchase timestamp, and 6-month maturity date. Treasury revenue is generated through delta-neutral market-making spreads, OTC desk settlement fees, and short-duration trade finance facilities.',
      'By aligning redemptions with a structured monthly window opening on the 1st of each calendar month and a 15-day settlement queue, Avora Bank eliminates maturity mismatch while delivering consistent monthly distributions.',
    ],
  },
];

export const DEFAULT_PUBLIC_PLATFORM_SETTINGS: Record<string, string> = {
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

export function formatOrdinalDay(dayNum: number): string {
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

export function buildPlatformVariablesFromSettings(
  settingsInput?: Record<string, string>
): Record<string, string> {
  const cfg = { ...DEFAULT_PUBLIC_PLATFORM_SETTINGS, ...(settingsInput || {}) };
  const pct = (n: number, d?: number) =>
    !Number.isFinite(n)
      ? '0%'
      : typeof d === 'number'
      ? `${n.toFixed(d)}%`
      : `${Number(n.toFixed(4)).toString()}%`;
  const slash = (n: number) => (!Number.isFinite(n) ? '0' : Number(n.toFixed(4)).toString());
  const usd = (n: number) => {
    if (!Number.isFinite(n)) return '$0';
    const hasFrac = Math.round(n * 100) % 100 !== 0;
    return `$${n.toLocaleString('en-US', {
      minimumFractionDigits: hasFrac ? 2 : 0,
      maximumFractionDigits: hasFrac ? 2 : 0,
    })}`;
  };

  const fxMargin = parseFloat(cfg.remittance_margin_percent || '2.0');
  const transferFee = parseFloat(cfg.remittance_fee_percent || '3.0');
  const allocFee = parseFloat(cfg.startup_allocation_fee_percent || '5.0');
  const profitShare = parseFloat(cfg.startup_profit_share_percent || '5.0');
  const monthlyRate = parseFloat(cfg.package_monthly_return_rate || '0.01') * 100;
  const lockInMonths = parseInt(cfg.package_lock_in_months || cfg.package_min_lockin_months || '6', 10);
  const pkgMin = parseFloat(cfg.package_min_amount || '1000');
  const pkgMax = parseFloat(cfg.package_max_amount || '10000');
  const payoutDay = parseInt(cfg.payout_day_of_month || '1', 10);
  const wdDay = parseInt(cfg.withdrawal_window_day || '1', 10);
  const wdProc = parseInt(cfg.withdrawal_processing_days || '15', 10);
  const wdFee = parseFloat(cfg.withdrawal_fee_percent || '0.0');
  const wdSpread = parseFloat(cfg.withdrawal_fx_spread_percent || '0.0');
  const otcOp = parseFloat(cfg.otc_operator_fee_percent || '1.5');
  const otcPlat = parseFloat(cfg.otc_platform_fee_percent || '0.5');
  const otcSpread = parseFloat(cfg.otc_spread_percent || '1.0');
  const otcDep = parseFloat(cfg.otc_security_deposit_usd || '1000');
  const p2pDep = parseFloat(cfg.p2p_security_deposit_usd || '50');
  const p2pLimit = parseFloat(cfg.p2p_daily_limit_usd || '5000');
  const startupMin = parseFloat(cfg.startup_min_investment_usd || '250');
  const cardFee = parseFloat(cfg.virtual_card_issuance_fee || '10');
  const rzpFee = parseFloat(cfg.razorpay_commission_percent || '5.0');

  return {
    fx_margin: pct(fxMargin),
    fx_margin_decimal: pct(fxMargin, 1),
    transfer_fee: pct(transferFee),
    transfer_fee_decimal: pct(transferFee, 1),
    corridors_count: (cfg.remittance_corridors_count || '7').trim(),
    countries_count: (cfg.remittance_countries_count || '110+').trim(),
    delivery_days: (cfg.remittance_delivery_days || '2').trim(),
    allocation_fee: pct(allocFee),
    profit_share_fee: pct(profitShare),
    fee_model_slash: `${slash(allocFee)}/${slash(profitShare)}`,
    startup_min_investment: usd(startupMin),
    monthly_return: pct(monthlyRate),
    monthly_return_decimal: pct(monthlyRate, 1),
    lock_in_months: String(Number.isFinite(lockInMonths) && lockInMonths > 0 ? lockInMonths : 6),
    package_min: usd(pkgMin),
    package_max: usd(pkgMax),
    payout_day: formatOrdinalDay(Number.isFinite(payoutDay) ? payoutDay : 1),
    withdrawal_window_day: formatOrdinalDay(Number.isFinite(wdDay) ? wdDay : 1),
    withdrawal_processing_days: String(Number.isFinite(wdProc) ? wdProc : 15),
    withdrawal_fee: pct(wdFee),
    withdrawal_fx_spread: pct(wdSpread),
    otc_total_fee: pct(otcOp + otcPlat, 1),
    otc_broker_fee: pct(otcOp, 1),
    otc_platform_fee: pct(otcPlat, 1),
    otc_spread: pct(otcSpread, 1),
    otc_deposit: usd(otcDep),
    p2p_deposit: usd(p2pDep),
    p2p_daily_limit: usd(p2pLimit),
    card_issuance_fee: usd(cardFee),
    razorpay_fee: pct(rzpFee),
  };
}

export function interpolatePlatformTokens(
  input: string,
  vars?: Record<string, string>
): string {
  if (!input || !input.includes('{{')) return input;
  const resolvedVars = vars || buildPlatformVariablesFromSettings();
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) =>
    resolvedVars[key] !== undefined ? resolvedVars[key] : match
  );
}

export function formatBlogDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function mapApiBlogToPostItem(
  b: any,
  resolveMediaUrlFn?: (url?: string | null) => string
): BlogPostItem {
  const resolveUrl = resolveMediaUrlFn || ((u?: string | null) => u || '');
  const rawCover = resolveUrl(b.coverImage) || resolveUrl(b.bannerSvgUrl);
  const cacheTag =
    b.lastNewsSync || b.updatedAt ? `?t=${new Date(b.lastNewsSync || b.updatedAt).getTime()}` : '';

  let parsedTakeaways: string[] = [];
  if (Array.isArray(b.keyTakeaways)) {
    parsedTakeaways = b.keyTakeaways.map((t: any) => String(t).trim()).filter(Boolean);
  } else if (typeof b.keyTakeaways === 'string' && b.keyTakeaways.trim()) {
    try {
      const arr = JSON.parse(b.keyTakeaways);
      if (Array.isArray(arr)) {
        parsedTakeaways = arr.map((t: any) => String(t).trim()).filter(Boolean);
      }
    } catch {
      parsedTakeaways = b.keyTakeaways
        .split(/\r?\n/)
        .map((t: string) => t.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean);
    }
  }

  const parsedTags = Array.isArray(b.tags)
    ? b.tags.map((t: any) => String(t).replace(/^#/, '').trim()).filter(Boolean)
    : typeof b.tags === 'string' && b.tags.trim()
    ? b.tags
        .split(',')
        .map((t: string) => t.replace(/^#/, '').trim())
        .filter(Boolean)
    : ['Avora Bank', 'Research'];

  const parsedContent = Array.isArray(b.content)
    ? b.content.map((p: any) => String(p).trim()).filter(Boolean)
    : typeof b.content === 'string'
    ? b.content
        .split(/\n\s*\n/)
        .map((p: string) => p.trim())
        .filter(Boolean)
    : [];

  return {
    id: b.id,
    slug: b.slug,
    title: b.title || 'Untitled Research Paper',
    excerpt: b.excerpt || b.summary || '',
    category: b.category || 'Market Research',
    readTime: b.readTime || '5 min read',
    publishedAt: b.publishedAt || b.createdAt || new Date().toISOString(),
    authorName: b.authorName || b.author || 'Avora Bank Research Team',
    authorRole:
      b.authorRole ||
      (b.ticker ? `${b.ticker} • Quantitative Equity & Macro Desk` : 'Avora Bank Research Desk'),
    coverImage: rawCover
      ? `${rawCover}${rawCover.endsWith('.svg') ? cacheTag : ''}`
      : 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80',
    isFeatured: Boolean(b.isFeatured),
    tags: parsedTags.length > 0 ? parsedTags : ['Avora Bank', 'Research'],
    content: parsedContent,
    keyTakeaways: parsedTakeaways,
  };
}

