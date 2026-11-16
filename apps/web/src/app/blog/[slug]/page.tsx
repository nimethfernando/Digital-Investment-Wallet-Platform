'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api, resolveMediaUrl } from '../../../lib/api';
import { BLOG_POSTS_DATA, BlogPostItem, formatBlogDate, mapApiBlogToPostItem } from '../../../lib/blog-data';
import {
  ArrowLeft,
  Clock,
  Calendar,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  User,
  ExternalLink,
  TrendingUp,
  Radio,
  Smile,
} from 'lucide-react';

interface LiveHighlight {
  text: string;
  source: string;
  url?: string;
}

interface NewsUpdateItem {
  id: string;
  headline: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  publishedAt: string;
}

interface ExtendedBlogPost extends BlogPostItem {
  ticker?: string | null;
  lastPrice?: string | null;
  priceChange?: string | null;
  lastNewsSync?: string | null;
  autoTrackNews?: boolean;
  memeUrl?: string | null;
  bannerMeta?: any | null;
  highlights?: LiveHighlight[];
  newsUpdates?: NewsUpdateItem[];
}

function timeAgo(iso?: string | null): string {
  if (!iso) return 'recently';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diffMs / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default function BlogPostDetailPage() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : '';

  const [post, setPost] = useState<ExtendedBlogPost | null>(() => {
    return BLOG_POSTS_DATA.find((b) => b.slug === slug) || null;
  });
  const [allPosts, setAllPosts] = useState<BlogPostItem[]>(BLOG_POSTS_DATA);
  const [loadingPost, setLoadingPost] = useState<boolean>(true);

  useEffect(() => {
    api
      .get('/cms/blogs')
      .then((res) => {
        if (Array.isArray(res.data?.blogs) && res.data.blogs.length > 0) {
          setAllPosts(res.data.blogs.map((b: any) => mapApiBlogToPostItem(b, resolveMediaUrl)));
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!slug) return;
    setLoadingPost(true);
    const foundStatic = BLOG_POSTS_DATA.find((b) => b.slug === slug);
    if (foundStatic) {
      setPost(foundStatic);
    }

    api
      .get(`/cms/blogs/${slug}?preview=true`)
      .then((res) => {
        const b = res.data?.blog;
        if (b) {
          let parsedTakeaways = foundStatic?.keyTakeaways || [];
          try {
            if (typeof b.keyTakeaways === 'string' && b.keyTakeaways.trim()) {
              const arr = JSON.parse(b.keyTakeaways);
              if (Array.isArray(arr)) parsedTakeaways = arr;
            } else if (Array.isArray(b.keyTakeaways)) {
              parsedTakeaways = b.keyTakeaways;
            }
          } catch {
            if (typeof b.keyTakeaways === 'string') {
              parsedTakeaways = b.keyTakeaways
                .split(/\r?\n/)
                .map((s: string) => s.replace(/^[-*•]\s*/, '').trim())
                .filter(Boolean);
            }
          }

          let parsedHighlights: LiveHighlight[] = [];
          try {
            if (typeof b.highlights === 'string') {
              const arr = JSON.parse(b.highlights);
              if (Array.isArray(arr)) parsedHighlights = arr;
            } else if (Array.isArray(b.highlights)) {
              parsedHighlights = b.highlights;
            }
          } catch {}

          let parsedBannerMeta: any = null;
          try {
            if (typeof b.bannerData === 'string') {
              parsedBannerMeta = JSON.parse(b.bannerData);
            }
          } catch {}

          const cacheTag = b.lastNewsSync || b.updatedAt ? `?t=${new Date(b.lastNewsSync || b.updatedAt).getTime()}` : '';
          const rawCover = resolveMediaUrl(b.coverImage) || resolveMediaUrl(b.bannerSvgUrl);
          const rawMeme = resolveMediaUrl(b.memeUrl);

          setPost({
            id: b.id,
            slug: b.slug,
            title: b.title,
            excerpt: b.excerpt || b.summary || '',
            category: b.category || 'Treasury & Yield',
            readTime: b.readTime || '5 min read',
            publishedAt: b.publishedAt || b.createdAt || '2026-10-20',
            authorName: b.authorName || b.author || 'Avora Institutional Research',
            authorRole:
              b.authorRole ||
              (b.ticker ? `${b.ticker} • Quantitative Equity & Macro Desk` : 'Avora Bank Research Desk'),
            coverImage: rawCover
              ? `${rawCover}${rawCover.endsWith('.svg') ? cacheTag : ''}`
              : 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80',
            tags: Array.isArray(b.tags)
              ? b.tags
              : typeof b.tags === 'string'
              ? b.tags.split(',').map((t: string) => t.trim()).filter(Boolean)
              : ['Avora Bank', 'Research'],
            content:
              typeof b.content === 'string'
                ? b.content.split(/\n\s*\n/).map((p: string) => p.trim()).filter(Boolean)
                : foundStatic?.content || [],
            keyTakeaways: parsedTakeaways,
            ticker: b.ticker || null,
            lastPrice: b.lastPrice || null,
            priceChange: b.priceChange || null,
            lastNewsSync: b.lastNewsSync || null,
            autoTrackNews: Boolean(b.autoTrackNews),
            memeUrl: rawMeme ? `${rawMeme}${rawMeme.endsWith('.svg') ? cacheTag : ''}` : null,
            bannerMeta: parsedBannerMeta,
            highlights: parsedHighlights,
            newsUpdates: Array.isArray(b.newsUpdates) ? b.newsUpdates : [],
          });
        }
      })
      .catch(() => {
        // Keep static post if found
      })
      .finally(() => {
        setLoadingPost(false);
      });
  }, [slug]);

  if (!post && loadingPost) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center space-y-3">
        <div className="w-8 h-8 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin mx-auto" />
        <p className="text-xs text-slate-500">Loading institutional research paper...</p>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center space-y-4">
        <h1 className="text-2xl font-black text-slate-900 dark:text-white">
          Research Article Not Found
        </h1>
        <p className="text-xs text-slate-500">
          The requested article could not be located in our research directory.
        </p>
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to All Articles
        </Link>
      </div>
    );
  }

  const relatedPosts = allPosts.filter((p) => p.slug !== post.slug).slice(0, 3);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-12">
      {/* Back Link */}
      <div>
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Avora Research &amp; Insights</span>
        </Link>
      </div>

      {/* Article Header */}
      <header className="space-y-5">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
            {post.category}
          </span>
          {post.ticker && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-900 dark:bg-slate-800 border border-slate-700 text-white font-mono font-bold">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
              <span>{post.ticker}</span>
              {post.lastPrice && <span className="text-slate-300">• {post.lastPrice}</span>}
              {post.priceChange && (
                <span className={post.priceChange.startsWith('-') ? 'text-rose-400' : 'text-emerald-400'}>
                  {post.priceChange}
                </span>
              )}
            </span>
          )}
          <span className="flex items-center gap-1 text-slate-500">
            <Clock className="w-3.5 h-3.5 text-emerald-500" />
            {post.readTime}
          </span>
          <span className="flex items-center gap-1 text-slate-500">
            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
            {formatBlogDate(post.publishedAt)}
          </span>
        </div>

        <h1 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white leading-tight tracking-tight">
          {post.title}
        </h1>

        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
          {post.excerpt}
        </p>

        {/* Author Bar */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-600/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
            <User className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-bold text-slate-900 dark:text-white">{post.authorName}</div>
            <div className="text-xs text-slate-500">{post.authorRole}</div>
          </div>
        </div>
      </header>

      {/* Cover Image */}
      <div className="relative aspect-[16/9] w-full rounded-3xl overflow-hidden shadow-2xl border border-slate-200 dark:border-slate-800 bg-slate-900">
        <img
          src={post.coverImage}
          alt={post.title}
          className="w-full h-full object-cover"
        />
      </div>

      {/* Quantitative Market Data Terminal Snapshot (Real API Metrics) */}
      {post.bannerMeta && (
        <div className="p-6 sm:p-7 rounded-3xl bg-slate-950 border border-slate-800 text-white shadow-xl space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-400">
              <TrendingUp className="w-4 h-4" />
              <span>Real-Time Quantitative &amp; Fundamental Terminal ({post.ticker || 'MARKET'})</span>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              Source: {post.bannerMeta.dataSource || 'Yahoo Finance v8 OHLCV + Wires'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 text-xs">
            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="text-[10px] font-bold uppercase text-slate-400">Last Traded Price</div>
              <div className="text-base font-black font-mono text-white">{post.lastPrice || post.bannerMeta.priceText}</div>
              <div className={`text-xs font-mono font-bold ${(post.priceChange || '').startsWith('-') ? 'text-rose-400' : 'text-emerald-400'}`}>
                {post.priceChange || post.bannerMeta.changeText} (1D Session)
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="text-[10px] font-bold uppercase text-slate-400">Intraday Range</div>
              <div className="text-sm font-black font-mono text-white">{post.bannerMeta.dayRangeText || 'N/A'}</div>
              <div className="text-[11px] text-slate-400">Exchange: {post.bannerMeta.exchange || 'NASDAQ'}</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="text-[10px] font-bold uppercase text-slate-400">52-Week Band</div>
              <div className="text-sm font-black font-mono text-sky-400">{post.bannerMeta.fiftyTwoWeekText || 'N/A'}</div>
              {typeof post.bannerMeta.technicals?.fiftyTwoWeekPct === 'number' && (
                <div className="w-full h-1.5 rounded-full bg-slate-800 overflow-hidden mt-1">
                  <div
                    className="h-full bg-sky-400 rounded-full"
                    style={{ width: `${post.bannerMeta.technicals.fiftyTwoWeekPct}%` }}
                  />
                </div>
              )}
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="text-[10px] font-bold uppercase text-slate-400">Session Volume</div>
              <div className="text-sm font-black font-mono text-white">{post.bannerMeta.volumeText || 'N/A'}</div>
              <div className="text-[11px] text-slate-400">Liquidity participation</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="text-[10px] font-bold uppercase text-slate-400">RSI (14-Day) Momentum</div>
              <div className="text-sm font-black font-mono text-emerald-400">{post.bannerMeta.rsiText || 'N/A'}</div>
              <div className="text-[11px] text-slate-400">Relative Strength Index</div>
            </div>

            <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
              <div className="text-[10px] font-bold uppercase text-slate-400">Moving Averages</div>
              <div className="text-xs font-black font-mono text-slate-200">{post.bannerMeta.smaText || 'N/A'}</div>
              <div className="text-[11px] text-slate-400">
                3M Return:{' '}
                <span className="font-mono font-bold text-white">
                  {typeof post.bannerMeta.technicals?.return3mPct === 'number'
                    ? `${post.bannerMeta.technicals.return3mPct >= 0 ? '+' : ''}${post.bannerMeta.technicals.return3mPct}%`
                    : 'N/A'}
                </span>
              </div>
            </div>

            {post.bannerMeta.fundamentals?.marketCap && (
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-[10px] font-bold uppercase text-slate-400">Market Cap &amp; Valuation</div>
                <div className="text-sm font-black font-mono text-white">{post.bannerMeta.fundamentals.marketCap}</div>
                <div className="text-[11px] text-slate-400 font-mono">
                  P/E: {post.bannerMeta.fundamentals.peRatio || 'N/A'} {post.bannerMeta.fundamentals.eps ? `• EPS ${post.bannerMeta.fundamentals.eps}` : ''}
                </div>
              </div>
            )}

            {post.bannerMeta.fundamentals?.analystConsensus && (
              <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-1">
                <div className="text-[10px] font-bold uppercase text-slate-400">Wall St. Analyst Consensus</div>
                <div className="text-xs font-black font-mono text-amber-400">{post.bannerMeta.fundamentals.analystConsensus}</div>
                <div className="text-[11px] text-slate-400">
                  {post.bannerMeta.fundamentals.analystTarget ? `Target: ${post.bannerMeta.fundamentals.analystTarget}` : 'Finnhub Institutional Survey'}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Key Takeaways Box */}
      {post.keyTakeaways && post.keyTakeaways.length > 0 && (
        <div className="p-6 sm:p-8 rounded-3xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 space-y-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <Sparkles className="w-4 h-4" />
            <span>Executive Summary &amp; Key Quantitative Takeaways</span>
          </div>
          <ul className="space-y-2.5">
            {post.keyTakeaways.map((point, idx) => (
              <li
                key={idx}
                className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Main Article Body (Supports Structured ## Section Headers) */}
      <div className="space-y-6 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
        {post.content.map((block, index) => {
          const trimmed = block.trim();
          if (trimmed.startsWith('## ')) {
            const newlineIdx = trimmed.indexOf('\n');
            const heading = newlineIdx !== -1 ? trimmed.slice(3, newlineIdx).trim() : trimmed.slice(3).trim();
            const body = newlineIdx !== -1 ? trimmed.slice(newlineIdx + 1).trim() : '';
            return (
              <div key={index} className="space-y-2.5 pt-2">
                <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight">
                  {heading}
                </h3>
                {body && <p className="leading-relaxed">{body}</p>}
              </div>
            );
          }
          return (
            <p key={index} className="leading-relaxed">
              {trimmed}
            </p>
          );
        })}
      </div>

      {/* Quantitative Sentiment & Bull/Bear Matrix Visual Card */}
      {post.memeUrl && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-950 p-4 sm:p-6 space-y-3 shadow-xl">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-emerald-400">
              <TrendingUp className="w-4 h-4" />
              Quantitative Sentiment &amp; Bull / Bear Thesis Matrix
            </span>
            <span className="font-mono">{post.ticker || 'AVORA'} RESEARCH</span>
          </div>
          <div className="overflow-hidden rounded-2xl border border-slate-800">
            <img src={post.memeUrl} alt={`${post.ticker || post.title} Sentiment Matrix`} className="w-full h-auto" />
          </div>
        </div>
      )}

      {/* CONTINUOUS LIVE NEWS & TODAY'S HIGHLIGHTS (TradingView-Style Feed Underneath Main Post) */}
      {(post.highlights?.length || post.newsUpdates?.length) ? (
        <section className="space-y-6 pt-6 border-t border-slate-200 dark:border-slate-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="space-y-1">
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                Headlines &amp; Live Corridor News
              </h2>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  Updated {timeAgo(post.lastNewsSync || post.publishedAt)}
                </span>
                {post.lastPrice && (
                  <>
                    <span>•</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">
                      {post.lastPrice}
                    </span>
                  </>
                )}
                {post.priceChange && (
                  <span
                    className={`font-mono font-bold ${
                      post.priceChange.startsWith('-') ? 'text-rose-500' : 'text-emerald-500'
                    }`}
                  >
                    {post.priceChange}
                  </span>
                )}
              </div>
            </div>

            {post.autoTrackNews && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                <Radio className="w-3.5 h-3.5 animate-pulse" />
                Auto-Updating Wire
              </span>
            )}
          </div>

          {/* Today's Highlights Box (Matches TradingView Screenshot) */}
          {post.highlights && post.highlights.length > 0 && (
            <div className="p-6 sm:p-7 rounded-3xl bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
              <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                Today&apos;s highlights
              </h3>
              <ul className="space-y-3">
                {post.highlights.map((item, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-3 text-xs sm:text-sm text-slate-700 dark:text-slate-200 leading-relaxed"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-900 dark:bg-emerald-400 mt-2 shrink-0" />
                    <div className="space-x-2">
                      <span>{item.text}</span>
                      {item.url ? (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[11px] font-bold text-slate-600 dark:text-slate-300 hover:text-emerald-500 transition-colors"
                        >
                          <span>{item.source}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-[11px] font-bold text-slate-500 dark:text-slate-400">
                          {item.source}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Continuous Live News Feed Underneath */}
          {post.newsUpdates && post.newsUpdates.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Latest Verified News Stream ({post.newsUpdates.length})
              </h4>
              <div className="divide-y divide-slate-200 dark:divide-slate-800 rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 overflow-hidden">
                {post.newsUpdates.map((news) => (
                  <a
                    key={news.id}
                    href={news.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block p-4 sm:p-5 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors group"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">{news.sourceName}</span>
                        <span className="text-slate-400">•</span>
                        <span className="text-slate-500">{timeAgo(news.publishedAt)}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold text-[10px] ${
                          news.sentiment === 'BULLISH'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : news.sentiment === 'BEARISH'
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                        }`}
                      >
                        {news.sentiment}
                      </span>
                    </div>
                    <h5 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors flex items-start justify-between gap-2">
                      <span>{news.headline}</span>
                      <ExternalLink className="w-3.5 h-3.5 shrink-0 mt-1 text-slate-400 group-hover:text-emerald-500" />
                    </h5>
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : null}

      {/* Tags */}
      <div className="pt-6 border-t border-slate-200 dark:border-slate-800 flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold text-slate-400 mr-1">Topics:</span>
        {post.tags.map((tag) => (
          <Link
            key={tag}
            href="/blog"
            className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-500 transition-colors"
          >
            #{tag}
          </Link>
        ))}
      </div>

      {/* Institutional CTA Box */}
      <div className="p-8 rounded-3xl bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 text-white border border-emerald-500/30 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-6">
        <div className="space-y-2">
          <h3 className="text-xl font-black">Experience Avora Bank’s Private Facilities</h3>
          <p className="text-xs text-slate-300 max-w-xl">
            Open your institutional digital wallet to access 1% monthly yield packages, global FX remittance corridors, startup equity crowdfunding, and our Tbilisi OTC counter.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <Link
            href="/register"
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg transition-all"
          >
            Open Account
          </Link>
          <Link
            href="/login"
            className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold text-xs transition-all"
          >
            Sign In
          </Link>
        </div>
      </div>

      {/* Related Articles */}
      <div className="pt-8 border-t border-slate-200 dark:border-slate-800 space-y-6">
        <h3 className="text-xl font-black text-slate-900 dark:text-white">
          Related Research &amp; Insights
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {relatedPosts.map((rel) => (
            <Link
              key={rel.id}
              href={`/blog/${rel.slug}`}
              className="group p-5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-emerald-500/50 transition-all space-y-2.5 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                  {rel.category}
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2">
                  {rel.title}
                </h4>
              </div>
              <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 pt-2">
                Read Paper <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

