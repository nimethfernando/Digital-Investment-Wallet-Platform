import { InquiryType } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { notificationService } from '../adapters/notification/notification.provider';
import { autoContentService } from './autoContent.service';

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
      'Segregated sub-ledgers isolate available liquidity, locked 6-month investment principal, and P2P/OTC escrow reserves.',
    ]),
    content: [
      'Modern fintech platforms frequently fail when they treat user balances as simple mutable numbers in a database table. Without strict double-entry constraints, race conditions, webhook retries, or partial network failures can silently create or destroy funds.',
      'At Avora Bank, our core engine is built from the ground up as a self-hosted, institutional double-entry ledger. Every financial event—whether a $10,000 package subscription, a 1.0% monthly yield distribution, an OTC settlement in Tbilisi, or a cross-border remittance to India—is recorded as an atomic journal entry where total debits strictly equal total credits.',
      'Each user wallet maintains three segregated balance states per currency (USD, USDT, EUR, INR, GEL): Available Balance, Locked Principal, and Pending Settlement. When a client subscribes to a 6-month fixed-term package, capital transitions atomically from Available Balance to Locked Principal with a unique Package Reference ID.',
      'On the 1st of every calendar month, our automated treasury scheduler calculates the 1.0% target yield across active packages and credits the investor’s internal wallet via verified treasury distribution journals—providing complete auditability from genesis to settlement.',
    ].join('\n\n'),
  },
  {
    slug: 'cross-border-remittance-corridors-fx-transparency',
    title: 'Re-Engineering Cross-Border Remittance: Transparent FX Margins Across 7 Global Corridors',
    summary:
      'How Avora Bank eliminates hidden correspondent banking spreads by combining live mid-market reference feeds with a disclosed 2% exchange-rate margin and 3% transfer fee across India, Sri Lanka, UAE, Georgia, EU, UK, and US.',
    category: 'Global Remittance',
    readTime: '5 min read',
    publishedAt: new Date('2026-10-20T09:00:00.000Z'),
    authorName: 'Elena Rostova',
    authorRole: 'Head of Global Settlement & FX Corridors',
    coverImage: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=80',
    isFeatured: false,
    tags: 'Global Transfer, FX Corridors, SWIFT & SEPA, Cross-Border Payments',
    keyTakeaways: JSON.stringify([
      'Upfront quote calculation discloses the exact reference rate, 2.0% FX adjustment, and 3.0% transfer fee before confirmation.',
      'Real-time 5-stage milestone tracking from compliance screening to partner bank settlement within 2 business days.',
      'Direct local clearing support for INR (NEFT/IMPS), LKR, AED, GEL, EUR (SEPA), GBP (Faster Payments), and USD (Fedwire/SWIFT).',
    ]),
    content: [
      'Traditional international wire transfers subject customers to opaque correspondent bank deductions and undisclosed exchange rate markups that often exceed 6% to 8% of the principal amount, with recipients receiving less than expected days later.',
      'Avora Bank’s Global Money Transfer service introduces institutional transparency to cross-border remittance. Before a client commits funds, our pricing engine locks a live quote displaying the exact benchmark rate, our configured 2% currency conversion margin, and the 3% transfer fee.',
      'Once funded from the client’s Avora wallet, the transfer progresses through five auditable stages: Submitted, Compliance Screened, Conversion Locked, Partner Processing, and Completed. Clients can monitor every milestone in real time with standard delivery completed within two business days.',
    ].join('\n\n'),
  },
  {
    slug: 'startengine-style-venture-equity-nominee-crowdfunding',
    title: 'Democratizing Venture Capital: Inside Avora’s Nominee Equity Marketplace & 5/5 Fee Model',
    summary:
      'Explore how Avora Investments enables private banking clients to allocate capital into vetted AI, CleanTech, and Fintech startups from $250 using a clean single-line cap-table nominee structure.',
    category: 'Venture Equity',
    readTime: '7 min read',
    publishedAt: new Date('2026-10-16T09:00:00.000Z'),
    authorName: 'Marcus Vance',
    authorRole: 'Managing Director, Avora Venture Desk',
    coverImage: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
    isFeatured: false,
    tags: 'Startup Equity, Venture Capital, Crowdfunding, Nominee Structure',
    keyTakeaways: JSON.stringify([
      'Minimum investments starting at $250 into institutional-grade seed and Series A rounds via SAFE, Preferred Equity, and Convertible Notes.',
      'Transparent 5% allocation fee at commitment and 5% profit-sharing fee strictly on net realized exit proceeds.',
      'Zero management fees on unrealized paper valuation markups.',
    ]),
    content: [
      'Historically, high-growth early-stage venture deals in AI infrastructure, clean energy, and cross-border fintech were restricted to institutional funds writing $250,000+ checks, while founders avoided retail crowdfunding due to messy cap tables.',
      'Avora Investments solves both sides of the market using the proven StartEngine/Seedrs nominee custody model. Avora holds a single consolidated legal line on the startup’s cap table while recording each investor’s beneficial equity entitlement inside our immutable ledger.',
      'Our alignment with investors is reinforced by our 5/5 pricing structure: a 5% Investment Allocation Fee on committed capital (meaning $950 of a $1,000 commitment goes directly into net startup allocation) and a 5% Profit-Sharing Fee charged exclusively when real cash exits or dividends are distributed above original principal.',
    ].join('\n\n'),
  },
  {
    slug: 'location-based-otc-liquidity-desks-p2p-security-deposits',
    title: 'Location-Based OTC Desks & Security Deposit Escrow: Building Trust in Local Crypto-Fiat Settlement',
    summary:
      'How Avora Bank combines a physical cash counter in Tbilisi with a global network of $1,000-bonded OTC desk operators and $50-bonded P2P market makers.',
    category: 'OTC & P2P Liquidity',
    readTime: '6 min read',
    publishedAt: new Date('2026-10-11T09:00:00.000Z'),
    authorName: 'Giorgi Beridze',
    authorRole: 'Head of Tbilisi OTC Operations',
    coverImage: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
    isFeatured: false,
    tags: 'OTC Desk, Tbilisi Counter, P2P Marketplace, Escrow Security',
    keyTakeaways: JSON.stringify([
      'Eligible operators stake a $1,000 security deposit to operate regional OTC desks in cities like Colombo, Dubai, and Tbilisi.',
      'Transparent total commission split between local OTC operators and Avora Bank platform settlement.',
      'Physical cash pickup and settlement available daily until 21:00 GCC time at our Freedom Square / Chavchavadze counter in Tbilisi.',
    ]),
    content: [
      'High-net-worth individuals and corporate treasuries frequently require reliable local settlement between USDT and regional fiat currencies without the counterparty risk of unregulated peer-to-peer chat groups.',
      'Avora Bank’s Global OTC Desk Marketplace establishes an accountable, location-based network of independent liquidity operators. Every OTC desk operator is required to lock a $1,000 security deposit (and $50 for P2P marketplace participants) as collateral against settlement defaults.',
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
    title: 'Inside Avora’s 6-Month Fixed-Term Investment Packages & Institutional Yield Strategy',
    summary:
      'How Avora Bank structures $1,000 to $10,000 capital packages with independent lock-in schedules, monthly 1st-of-the-month yield distributions, and two-stage withdrawal queues.',
    category: 'Treasury & Yield',
    readTime: '6 min read',
    publishedAt: new Date('2026-09-28T09:00:00.000Z'),
    authorName: 'Elena Rostova',
    authorRole: 'Head of Global Settlement & FX Corridors',
    coverImage: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
    isFeatured: false,
    tags: 'Investment Packages, Monthly Yield, Treasury Management, Risk Disclosure',
    keyTakeaways: JSON.stringify([
      'Each package ($1,000–$10,000) receives a unique Package Code with an independent 6-month maturity clock.',
      'Target 1.0% monthly return is calculated on active principal and credited on the 1st of every calendar month.',
      'Structured 1st-of-month withdrawal window with a 15-day treasury settlement queue ensures institutional liquidity stability.',
    ]),
    content: [
      'Predictable wealth compounding requires disciplined liquidity management. Rather than pooling client deposits into opaque demand accounts, Avora Bank issues discrete, trackable Investment Packages ranging from $1,000 to $10,000 USD.',
      'Every package is assigned its own cryptographic Package ID, purchase timestamp, and 6-month maturity date. Treasury revenue is generated through delta-neutral market-making spreads, OTC desk settlement fees, and short-duration trade finance facilities.',
      'By aligning redemptions with a structured monthly window opening on the 1st of each calendar month and a 15-day settlement queue, Avora Bank eliminates maturity mismatch while delivering consistent monthly distributions.',
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
      this.defaultPostsChecked = true;
      return insertedCount;
    } catch (err) {
      console.warn('[CmsService] ensureDefaultBlogPosts warning:', err);
      return 0;
    }
  }
  async getPublicSettings() {
    const settings = await prisma.cmsSetting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return map;
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
    return prisma.blogPost.findMany({
      where: includeDrafts ? {} : { isPublished: true },
      orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
      include: {
        _count: {
          select: { newsUpdates: true },
        },
      },
    });
  }

  async getBlogPostBySlug(slug: string, includeDrafts = false) {
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
    return post;
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
