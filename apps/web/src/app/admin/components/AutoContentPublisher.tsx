'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { api, extractErrorMessage, resolveMediaUrl } from '../../../lib/api';
import {
  Sparkles,
  Rocket,
  RefreshCw,
  ExternalLink,
  Radio,
  Trash2,
  CheckCircle2,
  Loader2,
  KeyRound,
  Smile,
  TrendingUp,
  Eye,
  EyeOff,
  Newspaper,
} from 'lucide-react';

interface AdminBlogItem {
  id: string;
  slug: string;
  title: string;
  category: string;
  ticker?: string | null;
  lastPrice?: string | null;
  priceChange?: string | null;
  autoTrackNews: boolean;
  lastNewsSync?: string | null;
  isPublished: boolean;
  coverImage?: string | null;
  memeUrl?: string | null;
  publishedAt: string;
  _count?: { newsUpdates: number };
}

const QUICK_TOPICS = [
  { label: 'Apple Inc. (AAPL)', value: 'Apple Inc.' },
  { label: 'NVIDIA (NVDA)', value: 'NVDA' },
  { label: 'Tesla (TSLA)', value: 'Tesla' },
  { label: 'Microsoft (MSFT)', value: 'MSFT' },
  { label: 'Bitcoin (BTC)', value: 'Bitcoin' },
  { label: 'Gold (XAU)', value: 'Gold' },
];

export default function AutoContentPublisher({
  onFeedback,
}: {
  onFeedback?: (msg: string, type: 'success' | 'error') => void;
}) {
  const [topic, setTopic] = useState('Apple Inc.');
  const [includeMeme, setIncludeMeme] = useState(true);
  const [autoTrackNews, setAutoTrackNews] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [progressStep, setProgressStep] = useState(0);

  const [lastResult, setLastResult] = useState<any | null>(null);
  const [posts, setPosts] = useState<AdminBlogItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  // Optional AI & News Keys Config
  const [showAiConfig, setShowAiConfig] = useState(false);
  const [aiStatus, setAiStatus] = useState<any | null>(null);
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [finnhubKey, setFinnhubKey] = useState('');
  const [alphaVantageKey, setAlphaVantageKey] = useState('');
  const [savingKeys, setSavingKeys] = useState(false);

  const loadPostsAndStatus = async () => {
    setLoadingPosts(true);
    try {
      const [blogsRes, aiRes] = await Promise.all([
        api.get('/cms/admin/blogs'),
        api.get('/cms/admin/ai-config'),
      ]);
      if (Array.isArray(blogsRes.data?.blogs)) {
        setPosts(blogsRes.data.blogs);
      }
      if (aiRes.data?.status) {
        setAiStatus(aiRes.data.status);
      }
    } catch {
      // ignore initial load hiccup
    } finally {
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    loadPostsAndStatus();
  }, []);

  const handleAutoPublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || publishing) return;

    setPublishing(true);
    setProgressStep(1);
    setLastResult(null);

    const stepTimer1 = setTimeout(() => setProgressStep(2), 1400);
    const stepTimer2 = setTimeout(() => setProgressStep(3), 3200);
    const stepTimer3 = setTimeout(() => setProgressStep(4), 5200);

    try {
      const res = await api.post('/cms/admin/blogs/auto-publish', {
        topic: topic.trim(),
        includeMeme,
        autoTrackNews,
      });

      if (res.data?.success) {
        setLastResult(res.data);
        onFeedback?.(res.data.message || 'Automated post published live!', 'success');
        await loadPostsAndStatus();
      }
    } catch (err: any) {
      onFeedback?.(extractErrorMessage(err, 'Failed to generate automated post'), 'error');
    } finally {
      clearTimeout(stepTimer1);
      clearTimeout(stepTimer2);
      clearTimeout(stepTimer3);
      setPublishing(false);
      setProgressStep(0);
    }
  };

  const handleSyncSingle = async (postId: string) => {
    setSyncingId(postId);
    try {
      const res = await api.post(`/cms/admin/blogs/${postId}/sync-news`);
      if (res.data?.success) {
        onFeedback?.(res.data.message || 'Synced fresh market news!', 'success');
        await loadPostsAndStatus();
      }
    } catch (err: any) {
      onFeedback?.(extractErrorMessage(err, 'News sync failed'), 'error');
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAll = async () => {
    setSyncingAll(true);
    try {
      const res = await api.get('/cms/blogs/cron-sync');
      if (res.data?.success) {
        onFeedback?.(
          `Synced ${res.data.syncedPosts} tracked topic(s), added ${res.data.addedStories} new headline(s).`,
          'success'
        );
        await loadPostsAndStatus();
      }
    } catch (err: any) {
      onFeedback?.(extractErrorMessage(err, 'Global news sync failed'), 'error');
    } finally {
      setSyncingAll(false);
    }
  };

  const handleTogglePostField = async (post: AdminBlogItem, field: 'isPublished' | 'autoTrackNews') => {
    try {
      await api.patch(`/cms/admin/blogs/${post.id}`, { [field]: !post[field] });
      await loadPostsAndStatus();
    } catch (err: any) {
      onFeedback?.(extractErrorMessage(err, 'Update failed'), 'error');
    }
  };

  const handleDeletePost = async (post: AdminBlogItem) => {
    if (!confirm(`Delete "${post.title}" and all tracked news updates?`)) return;
    try {
      await api.delete(`/cms/admin/blogs/${post.id}`);
      onFeedback?.('Post removed cleanly.', 'success');
      await loadPostsAndStatus();
    } catch (err: any) {
      onFeedback?.(extractErrorMessage(err, 'Delete failed'), 'error');
    }
  };

  const handleSaveAiKeys = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingKeys(true);
    try {
      const payload: Record<string, string> = {};
      if (openaiKey.trim()) payload.openaiApiKey = openaiKey.trim();
      if (geminiKey.trim()) payload.geminiApiKey = geminiKey.trim();
      if (finnhubKey.trim()) payload.finnhubApiKey = finnhubKey.trim();
      if (alphaVantageKey.trim()) payload.alphaVantageApiKey = alphaVantageKey.trim();

      const res = await api.post('/cms/admin/ai-config', payload);
      if (res.data?.success) {
        setAiStatus(res.data.status);
        setOpenaiKey('');
        setGeminiKey('');
        setFinnhubKey('');
        setAlphaVantageKey('');
        onFeedback?.('Market Data & AI API keys saved and activated.', 'success');
      }
    } catch (err: any) {
      onFeedback?.(extractErrorMessage(err, 'Failed to save API keys'), 'error');
    } finally {
      setSavingKeys(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* HERO: 1-CLICK AUTOMATED PUBLISHER */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/60 border border-slate-800 shadow-2xl space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>1-Click Institutional Research &amp; Live Data Engine</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Automated Topic-to-Publish Pipeline
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl">
              Enter any stock ticker or topic and click Post. The engine resolves real-time OHLCV quotes, RSI-14, SMA-20/50, 52W ranges, fundamental metrics &amp; news wires, generates an institutional report, terminal banner &amp; Bull/Bear thesis matrix, and continuously gathers live news underneath.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="px-3 py-1.5 rounded-xl bg-slate-800/90 border border-slate-700 text-[11px] font-semibold text-slate-300">
              Engine: <span className="text-emerald-400 font-bold">{aiStatus?.engineMode || 'Live Market OHLCV + RSS Engine'}</span>
            </span>
            <button
              type="button"
              onClick={() => setShowAiConfig((v) => !v)}
              className="px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-xs font-bold text-amber-300 flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              <span>{showAiConfig ? 'Hide API Keys' : 'Configure Market & AI API Keys'}</span>
            </button>
          </div>
        </div>

        {/* Market Data & AI API Keys Config */}
        {showAiConfig && (
          <form
            onSubmit={handleSaveAiKeys}
            className="p-5 rounded-2xl bg-slate-950/90 border border-amber-500/30 space-y-4 text-xs animate-in fade-in duration-150"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div>
                <p className="font-bold text-white text-sm">
                  Real-Time Market Data &amp; AI Synthesis API Keys
                </p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Yahoo Finance v8 OHLCV + Google/Yahoo RSS work out-of-the-box. Add a free <span className="text-emerald-400 font-semibold">Finnhub</span> or <span className="text-emerald-400 font-semibold">Alpha Vantage</span> API key to unlock real-time P/E, EPS, Market Cap, Beta, Wall St. Analyst Consensus &amp; institutional company news, plus <span className="text-emerald-400 font-semibold">OpenAI / Gemini</span> for deep LLM research synthesis.
                </p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-bold">
                    Finnhub Market API Key {aiStatus?.finnhubConfigured && <span className="text-emerald-400">(Active)</span>}
                  </label>
                  <a
                    href="https://finnhub.io/register"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-emerald-400 hover:underline"
                  >
                    Get free key ↗
                  </a>
                </div>
                <input
                  type="password"
                  value={finnhubKey}
                  onChange={(e) => setFinnhubKey(e.target.value)}
                  placeholder="Quotes, P/E, Analyst Ratings & News..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white outline-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-bold">
                    Alpha Vantage API Key {aiStatus?.alphaVantageConfigured && <span className="text-emerald-400">(Active)</span>}
                  </label>
                  <a
                    href="https://www.alphavantage.co/support/#api-key"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-emerald-400 hover:underline"
                  >
                    Get free key ↗
                  </a>
                </div>
                <input
                  type="password"
                  value={alphaVantageKey}
                  onChange={(e) => setAlphaVantageKey(e.target.value)}
                  placeholder="Fundamentals, EPS, Margin & Sentiment..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white outline-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-bold">
                    OpenAI API Key {aiStatus?.openaiConfigured && <span className="text-emerald-400">(Active)</span>}
                  </label>
                  <a
                    href="https://platform.openai.com/api-keys"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-emerald-400 hover:underline"
                  >
                    OpenAI Keys ↗
                  </a>
                </div>
                <input
                  type="password"
                  value={openaiKey}
                  onChange={(e) => setOpenaiKey(e.target.value)}
                  placeholder="sk-... (GPT-4o Research)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white outline-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-bold">
                    Google Gemini Key {aiStatus?.geminiConfigured && <span className="text-emerald-400">(Active)</span>}
                  </label>
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-emerald-400 hover:underline"
                  >
                    Google AI Studio ↗
                  </a>
                </div>
                <input
                  type="password"
                  value={geminiKey}
                  onChange={(e) => setGeminiKey(e.target.value)}
                  placeholder="AIza... (Gemini 2.0 Flash)"
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white outline-none"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={savingKeys}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer disabled:opacity-50"
              >
                {savingKeys ? 'Saving...' : 'Save & Activate API Keys'}
              </button>
            </div>
          </form>
        )}

        {/* Quick Topic Chips */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-400 font-semibold">Quick Topics:</span>
          {QUICK_TOPICS.map((q) => (
            <button
              key={q.value}
              type="button"
              onClick={() => setTopic(q.value)}
              className={`px-3 py-1 rounded-xl border font-bold transition-colors cursor-pointer ${
                topic.toLowerCase() === q.value.toLowerCase()
                  ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300'
                  : 'bg-slate-800/70 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {q.label}
            </button>
          ))}
        </div>

        {/* 1-Click Publish Form */}
        <form onSubmit={handleAutoPublish} className="space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              required
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter any company, stock ticker, crypto or topic (e.g. Apple Inc., AAPL, NVDA, Bitcoin)..."
              className="flex-1 px-4 py-3.5 rounded-2xl bg-slate-950 border border-slate-700 focus:border-emerald-500 text-white text-sm font-semibold outline-none"
            />
            <button
              type="submit"
              disabled={publishing || !topic.trim()}
              className="px-7 py-3.5 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 shrink-0"
            >
              {publishing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Generating &amp; Publishing...</span>
                </>
              ) : (
                <>
                  <Rocket className="w-4 h-4" />
                  <span>Post</span>
                </>
              )}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs text-slate-300">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={includeMeme}
                onChange={(e) => setIncludeMeme(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-emerald-500"
              />
              <Smile className="w-3.5 h-3.5 text-amber-400" />
              <span>Auto-create Quantitative Sentiment &amp; Bull/Bear Matrix graphic</span>
            </label>

            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={autoTrackNews}
                onChange={(e) => setAutoTrackNews(e.target.checked)}
                className="rounded border-slate-600 bg-slate-800 text-emerald-500"
              />
              <Radio className="w-3.5 h-3.5 text-emerald-400" />
              <span>Continuously gather &amp; publish live news underneath post</span>
            </label>
          </div>
        </form>

        {/* Live Automation Progress Steps */}
        {publishing && (
          <div className="p-4 rounded-2xl bg-slate-950/90 border border-emerald-500/30 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            {[
              { step: 1, text: 'Resolving live OHLCV & fundamentals' },
              { step: 2, text: 'Gathering verified market wires' },
              { step: 3, text: 'Writing report, terminal banner & matrix' },
              { step: 4, text: 'Publishing + arming live news feed' },
            ].map((s) => (
              <div
                key={s.step}
                className={`flex items-center gap-2 p-2.5 rounded-xl border ${
                  progressStep >= s.step
                    ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300 font-bold'
                    : 'border-slate-800 text-slate-500'
                }`}
              >
                {progressStep > s.step ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                ) : progressStep === s.step ? (
                  <Loader2 className="w-4 h-4 animate-spin text-emerald-400 shrink-0" />
                ) : (
                  <span className="w-4 h-4 rounded-full border border-slate-700 inline-block shrink-0" />
                )}
                <span>{s.text}</span>
              </div>
            ))}
          </div>
        )}

        {/* Instant Published Output Preview */}
        {lastResult?.post && (
          <div className="p-5 rounded-2xl bg-slate-950 border border-emerald-500/40 space-y-4 animate-in fade-in duration-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-emerald-400 font-bold">
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Published Live! Resolved {lastResult.stats?.tickerResolved} ({lastResult.stats?.livePrice}) • {lastResult.stats?.newsGathered} News Stories Attached
                </span>
              </div>
              <Link
                href={`/blog/${lastResult.post.slug}`}
                target="_blank"
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <span>Open Live Post</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lastResult.post.coverImage && (
                <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                  <img
                    src={`${resolveMediaUrl(lastResult.post.coverImage)}?t=${Date.now()}`}
                    alt="Generated Hero Banner"
                    className="w-full h-auto"
                  />
                </div>
              )}
              {lastResult.post.memeUrl && (
                <div className="rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                  <img
                    src={`${resolveMediaUrl(lastResult.post.memeUrl)}?t=${Date.now()}`}
                    alt="Generated Quantitative Sentiment Matrix"
                    className="w-full h-auto"
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* TRACKED PUBLICATIONS & CONTINUOUS NEWS MANAGER */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden">
        <div className="p-5 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Newspaper className="w-5 h-5 text-emerald-400" />
            <div>
              <h3 className="text-sm font-black text-white">Published Research &amp; Auto-Tracked News Feeds</h3>
              <p className="text-[11px] text-slate-400">
                Posts with Auto-Track enabled automatically gather &amp; summarize breaking headlines underneath the main article.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSyncAll}
              disabled={syncingAll}
              className="px-3.5 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 text-emerald-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
              <span>{syncingAll ? 'Syncing All...' : 'Sync All Tracked News'}</span>
            </button>
          </div>
        </div>

        {loadingPosts ? (
          <div className="py-12 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Loading automated publications...</span>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-14 text-center text-xs text-slate-400 space-y-2">
            <p>No automated posts published yet. Enter a topic like &quot;Apple Inc.&quot; above and click Post.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {posts.map((p) => (
              <div key={p.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-800/30">
                <div className="space-y-1.5 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    {p.ticker && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 font-mono font-bold text-white inline-flex items-center gap-1">
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                        {p.ticker} {p.lastPrice ? `• ${p.lastPrice}` : ''} {p.priceChange || ''}
                      </span>
                    )}
                    <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 font-bold">
                      {p._count?.newsUpdates ?? 0} live news items
                    </span>
                    <span className="text-slate-500">
                      {p.lastNewsSync ? `Synced ${new Date(p.lastNewsSync).toLocaleString()}` : 'Not synced yet'}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-white truncate">{p.title}</h4>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
                  <button
                    type="button"
                    onClick={() => handleSyncSingle(p.id)}
                    disabled={syncingId === p.id}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncingId === p.id ? 'animate-spin' : ''}`} />
                    <span>Sync News</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTogglePostField(p, 'autoTrackNews')}
                    className={`px-3 py-1.5 rounded-xl border font-bold flex items-center gap-1 cursor-pointer ${
                      p.autoTrackNews
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <Radio className="w-3.5 h-3.5" />
                    <span>{p.autoTrackNews ? 'Tracking On' : 'Paused'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleTogglePostField(p, 'isPublished')}
                    className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                    title={p.isPublished ? 'Published (click to hide)' : 'Hidden (click to publish)'}
                  >
                    {p.isPublished ? <Eye className="w-3.5 h-3.5 text-emerald-400" /> : <EyeOff className="w-3.5 h-3.5 text-slate-500" />}
                  </button>

                  <Link
                    href={`/blog/${p.slug}`}
                    target="_blank"
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-1"
                  >
                    <span>View</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>

                  <button
                    type="button"
                    onClick={() => handleDeletePost(p)}
                    className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                    title="Delete Post"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
