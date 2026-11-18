'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { api, extractErrorMessage, resolveMediaUrl } from '../../../lib/api';
import {
  formatBlogDate,
  buildPlatformVariablesFromSettings,
  interpolatePlatformTokens,
} from '../../../lib/blog-data';
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
  Plus,
  Edit3,
  Search,
  Star,
  Calendar,
  Clock,
  User,
  Tag,
  X,
  FileText,
  BookOpen,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Sliders,
} from 'lucide-react';

interface AdminBlogItem {
  id: string;
  slug: string;
  title: string;
  summary: string;
  content: string;
  category: string;
  tags?: string | null;
  keyTakeaways?: string | null;
  authorName: string;
  authorRole?: string | null;
  readTime: string;
  ticker?: string | null;
  lastPrice?: string | null;
  priceChange?: string | null;
  autoTrackNews: boolean;
  lastNewsSync?: string | null;
  isPublished: boolean;
  isFeatured?: boolean;
  coverImage?: string | null;
  bannerSvgUrl?: string | null;
  memeUrl?: string | null;
  publishedAt: string;
  updatedAt?: string;
  _count?: { newsUpdates: number };
}

const PRESET_CATEGORIES = [
  'Ledger Security',
  'Global Remittance',
  'Venture Equity',
  'OTC & P2P Liquidity',
  'Tokenomics',
  'Treasury & Yield',
  'Market Research',
  'Macro & FX',
];

const PRESET_COVERS = [
  {
    label: 'Ledger & Cryptography',
    url: 'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80',
  },
  {
    label: 'Global FX & Banking',
    url: 'https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?auto=format&fit=crop&w=1200&q=80',
  },
  {
    label: 'Venture & Equity',
    url: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&w=1200&q=80',
  },
  {
    label: 'OTC Trading & Liquidity',
    url: 'https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?auto=format&fit=crop&w=1200&q=80',
  },
  {
    label: 'Digital Assets & L2',
    url: 'https://images.unsplash.com/photo-1621761191319-c6fb62004040?auto=format&fit=crop&w=1200&q=80',
  },
  {
    label: 'Institutional Treasury',
    url: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1200&q=80',
  },
];

const QUICK_TOPICS = [
  { label: 'Apple Inc. (AAPL)', value: 'Apple Inc.' },
  { label: 'NVIDIA (NVDA)', value: 'NVDA' },
  { label: 'Tesla (TSLA)', value: 'Tesla' },
  { label: 'Microsoft (MSFT)', value: 'MSFT' },
  { label: 'Bitcoin (BTC)', value: 'Bitcoin' },
  { label: 'Gold (XAU)', value: 'Gold' },
];

function slugifyTitle(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 130);
}

function parseTakeawaysToMultiline(raw?: string | null): string {
  if (!raw) return '';
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map((item) => String(item).trim()).filter(Boolean).join('\n');
    }
  } catch {
    // plain text fallback
  }
  return String(raw).trim();
}

function toDateInputValue(dateStr?: string | null): string {
  if (!dateStr) return new Date().toISOString().slice(0, 10);
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export default function AutoContentPublisher({
  onFeedback,
  onOpenRatesConfig,
}: {
  onFeedback?: (msg: string, type: 'success' | 'error') => void;
  onOpenRatesConfig?: () => void;
}) {
  // Articles List & Filter State
  const [posts, setPosts] = useState<AdminBlogItem[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PUBLISHED' | 'DRAFT' | 'FEATURED'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [restoringDefaults, setRestoringDefaults] = useState(false);

  // Live Platform Variables for Dynamic Blog Tokens
  const [liveVars, setLiveVars] = useState<Record<string, string>>(() =>
    buildPlatformVariablesFromSettings()
  );
  const [tokenCatalog, setTokenCatalog] = useState<
    Array<{ token: string; key: string; label: string; group: string }>
  >([]);
  const [activeEditorField, setActiveEditorField] = useState<
    'title' | 'summary' | 'takeaways' | 'content'
  >('content');
  const [showTokenPicker, setShowTokenPicker] = useState(true);

  // Article Create / Edit Modal State
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPostId, setEditingPostId] = useState<string | null>(null);
  const [editorTab, setEditorTab] = useState<'edit' | 'preview'>('edit');
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);
  const [savingArticle, setSavingArticle] = useState(false);
  const [editorError, setEditorError] = useState<string | null>(null);

  const [formTitle, setFormTitle] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formCategory, setFormCategory] = useState('Ledger Security');
  const [formTags, setFormTags] = useState('Double-Entry Ledger, Treasury Security, Auditability');
  const [formAuthorName, setFormAuthorName] = useState('Dr. Viktor Kovalenko');
  const [formAuthorRole, setFormAuthorRole] = useState('Chief Ledger Architect, Avora Bank');
  const [formPublishedAt, setFormPublishedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [formReadTime, setFormReadTime] = useState('5 min read');
  const [formCoverImage, setFormCoverImage] = useState(PRESET_COVERS[0].url);
  const [formSummary, setFormSummary] = useState('');
  const [formKeyTakeaways, setFormKeyTakeaways] = useState('');
  const [formContent, setFormContent] = useState('');
  const [formIsPublished, setFormIsPublished] = useState(true);
  const [formIsFeatured, setFormIsFeatured] = useState(false);

  // AI Auto-Publisher State
  const [showAutoPublisher, setShowAutoPublisher] = useState(false);
  const [topic, setTopic] = useState('Apple Inc.');
  const [includeMeme, setIncludeMeme] = useState(true);
  const [autoTrackNews, setAutoTrackNews] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const [lastResult, setLastResult] = useState<any | null>(null);
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
      const [blogsRes, aiRes, varsRes] = await Promise.all([
        api.get('/cms/admin/blogs'),
        api.get('/cms/admin/ai-config'),
        api.get('/cms/variables').catch(() => ({ data: null })),
      ]);
      if (Array.isArray(blogsRes.data?.blogs)) {
        setPosts(blogsRes.data.blogs);
      }
      if (aiRes.data?.status) {
        setAiStatus(aiRes.data.status);
      }
      if (varsRes.data?.variables) {
        setLiveVars(varsRes.data.variables);
      }
      if (Array.isArray(varsRes.data?.catalog)) {
        setTokenCatalog(varsRes.data.catalog);
      }
    } catch {
      // ignore initial load hiccup
    } finally {
      setLoadingPosts(false);
    }
  };

  const insertTokenIntoActiveField = (token: string) => {
    if (activeEditorField === 'title') {
      setFormTitle((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${token}`);
    } else if (activeEditorField === 'summary') {
      setFormSummary((prev) => `${prev}${prev && !prev.endsWith(' ') ? ' ' : ''}${token}`);
    } else if (activeEditorField === 'takeaways') {
      setFormKeyTakeaways((prev) => `${prev}${prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : ''}${token}`);
    } else {
      setFormContent((prev) => `${prev}${prev && !prev.endsWith(' ') && !prev.endsWith('\n') ? ' ' : ''}${token}`);
    }
  };

  useEffect(() => {
    loadPostsAndStatus();
  }, []);

  const allCategories = useMemo(() => {
    const set = new Set<string>(PRESET_CATEGORIES);
    posts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return Array.from(set);
  }, [posts]);

  const filteredPosts = useMemo(() => {
    return posts.filter((p) => {
      if (statusFilter === 'PUBLISHED' && !p.isPublished) return false;
      if (statusFilter === 'DRAFT' && p.isPublished) return false;
      if (statusFilter === 'FEATURED' && !p.isFeatured) return false;
      if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;

      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        (p.summary || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.authorName || '').toLowerCase().includes(q) ||
        (p.tags || '').toLowerCase().includes(q) ||
        (p.slug || '').toLowerCase().includes(q)
      );
    });
  }, [posts, statusFilter, categoryFilter, searchQuery]);

  const wordCount = useMemo(() => {
    return formContent.trim().split(/\s+/).filter(Boolean).length;
  }, [formContent]);

  const estimatedReadTime = useMemo(() => {
    const mins = Math.max(1, Math.ceil(wordCount / 200));
    return `${mins} min read`;
  }, [wordCount]);

  const openCreateModal = () => {
    setEditingPostId(null);
    setEditorTab('edit');
    setSlugManuallyEdited(false);
    setEditorError(null);
    setFormTitle('');
    setFormSlug('');
    setFormCategory('Ledger Security');
    setFormTags('Avora Bank, Institutional Research, Treasury');
    setFormAuthorName('Dr. Viktor Kovalenko');
    setFormAuthorRole('Chief Ledger Architect, Avora Bank');
    setFormPublishedAt(new Date().toISOString().slice(0, 10));
    setFormReadTime('5 min read');
    setFormCoverImage(PRESET_COVERS[0].url);
    setFormSummary('');
    setFormKeyTakeaways('');
    setFormContent('');
    setFormIsPublished(true);
    setFormIsFeatured(false);
    setEditorOpen(true);
  };

  const openEditModal = (post: AdminBlogItem) => {
    setEditingPostId(post.id);
    setEditorTab('edit');
    setSlugManuallyEdited(true);
    setEditorError(null);
    setFormTitle(post.title || '');
    setFormSlug(post.slug || '');
    setFormCategory(post.category || 'Market Research');
    setFormTags(post.tags || '');
    setFormAuthorName(post.authorName || 'Avora Bank Research Team');
    setFormAuthorRole(post.authorRole || 'Avora Bank Research Desk');
    setFormPublishedAt(toDateInputValue(post.publishedAt));
    setFormReadTime(post.readTime || '5 min read');
    setFormCoverImage(
      post.coverImage ||
        post.bannerSvgUrl ||
        PRESET_COVERS[0].url
    );
    setFormSummary(post.summary || '');
    setFormKeyTakeaways(parseTakeawaysToMultiline(post.keyTakeaways));
    setFormContent(post.content || '');
    setFormIsPublished(Boolean(post.isPublished));
    setFormIsFeatured(Boolean(post.isFeatured));
    setEditorOpen(true);
  };

  const handleSaveArticle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setEditorError('Please enter an article title.');
      return;
    }
    if (!formContent.trim()) {
      setEditorError('Please enter the article body copy.');
      return;
    }

    setSavingArticle(true);
    setEditorError(null);

    const payload = {
      title: formTitle.trim(),
      slug: formSlug.trim() || slugifyTitle(formTitle),
      category: formCategory.trim() || 'Market Research',
      tags: formTags
        .split(',')
        .map((t) => t.replace(/^#/, '').trim())
        .filter(Boolean),
      authorName: formAuthorName.trim() || 'Avora Bank Research Team',
      authorRole: formAuthorRole.trim() || 'Avora Bank Research Desk',
      publishedAt: formPublishedAt ? new Date(`${formPublishedAt}T09:00:00.000Z`).toISOString() : new Date().toISOString(),
      readTime: formReadTime.trim() || estimatedReadTime,
      coverImage: formCoverImage.trim() || PRESET_COVERS[0].url,
      summary: formSummary.trim(),
      keyTakeaways: formKeyTakeaways
        .split(/\r?\n/)
        .map((line) => line.replace(/^[-*•]\s*/, '').trim())
        .filter(Boolean),
      content: formContent.trim(),
      isPublished: formIsPublished,
      isFeatured: formIsFeatured,
    };

    try {
      if (editingPostId) {
        const res = await api.put(`/cms/admin/blogs/${editingPostId}`, payload);
        if (res.data?.success) {
          onFeedback?.(res.data.message || 'Article updated!', 'success');
          setEditorOpen(false);
          await loadPostsAndStatus();
        }
      } else {
        const res = await api.post('/cms/admin/blogs', payload);
        if (res.data?.success) {
          onFeedback?.(res.data.message || 'Article published!', 'success');
          setEditorOpen(false);
          await loadPostsAndStatus();
        }
      }
    } catch (err: any) {
      setEditorError(extractErrorMessage(err, 'Failed to save article.'));
    } finally {
      setSavingArticle(false);
    }
  };

  const handleRestoreDefaults = async () => {
    setRestoringDefaults(true);
    try {
      const res = await api.post('/cms/admin/blogs/seed-defaults');
      if (res.data?.success) {
        onFeedback?.(res.data.message || 'Default research papers verified.', 'success');
        await loadPostsAndStatus();
      }
    } catch (err: any) {
      onFeedback?.(extractErrorMessage(err, 'Failed to restore default papers'), 'error');
    } finally {
      setRestoringDefaults(false);
    }
  };

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

  const handleTogglePostField = async (
    post: AdminBlogItem,
    field: 'isPublished' | 'autoTrackNews' | 'isFeatured'
  ) => {
    try {
      await api.patch(`/cms/admin/blogs/${post.id}`, { [field]: !post[field] });
      onFeedback?.(
        field === 'isPublished'
          ? !post.isPublished
            ? `"${post.title}" is now Published & Live.`
            : `"${post.title}" moved to Drafts.`
          : field === 'isFeatured'
          ? !post.isFeatured
            ? `"${post.title}" set as Featured Research Paper.`
            : `Removed Featured status from "${post.title}".`
          : 'Updated tracking status.',
        'success'
      );
      await loadPostsAndStatus();
    } catch (err: any) {
      onFeedback?.(extractErrorMessage(err, 'Update failed'), 'error');
    }
  };

  const handleDeletePost = async (post: AdminBlogItem) => {
    if (!confirm(`Delete "${post.title}" permanently from the website?`)) return;
    try {
      await api.delete(`/cms/admin/blogs/${post.id}`);
      onFeedback?.('Article deleted.', 'success');
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

  const publishedCount = posts.filter((p) => p.isPublished).length;
  const draftCount = posts.filter((p) => !p.isPublished).length;

  return (
    <div className="space-y-6">
      {/* -------------------------------------------------------------------- */}
      {/* TOP BAR: INSTITUTIONAL THOUGHT LEADERSHIP & RESEARCH PAPERS CMS      */}
      {/* -------------------------------------------------------------------- */}
      <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950/60 border border-slate-800 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-[11px] font-bold uppercase tracking-wider">
              <BookOpen className="w-3.5 h-3.5" />
              <span>Announcements &amp; Platform Updates CMS</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
              Manage Official Announcements &amp; Updates
            </h2>
            <p className="text-xs text-slate-400 max-w-2xl">
              Create, edit, publish, unpublish, feature, or delete any announcement on the Home Page and <code className="text-emerald-400">/announcements</code> Directory — including title, category, tags, author, publish date, key takeaways, and body copy.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={openCreateModal}
              className="px-5 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs shadow-lg shadow-emerald-950/50 flex items-center gap-2 cursor-pointer transition-all"
            >
              <Plus className="w-4 h-4" />
              <span>+ Create Announcement</span>
            </button>

            {onOpenRatesConfig && (
              <button
                type="button"
                onClick={onOpenRatesConfig}
                className="px-4 py-3 rounded-2xl bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/40 text-rose-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Sliders className="w-3.5 h-3.5 text-rose-400" />
                <span>Platform Rates &amp; Fees Settings</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setShowAutoPublisher((v) => !v)}
              className="px-4 py-3 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-emerald-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{showAutoPublisher ? 'Hide AI Auto-Publisher' : '1-Click AI Auto-Publisher'}</span>
              {showAutoPublisher ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            <Link
              href="/announcements"
              target="_blank"
              className="px-4 py-3 rounded-2xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <span>View Public /announcements</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        {/* Summary KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/90">
            <div className="text-slate-400 font-semibold">Total Articles</div>
            <div className="text-xl font-black text-white font-mono mt-0.5">{posts.length}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/90">
            <div className="text-slate-400 font-semibold">Published (Live)</div>
            <div className="text-xl font-black text-emerald-400 font-mono mt-0.5">{publishedCount}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/90">
            <div className="text-slate-400 font-semibold">Hidden / Drafts</div>
            <div className="text-xl font-black text-amber-400 font-mono mt-0.5">{draftCount}</div>
          </div>
          <div className="p-3.5 rounded-2xl bg-slate-950/70 border border-slate-800/90 flex flex-col justify-between">
            <div className="text-slate-400 font-semibold">Default Papers</div>
            <button
              type="button"
              onClick={handleRestoreDefaults}
              disabled={restoringDefaults}
              className="mt-1 inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:underline cursor-pointer disabled:opacity-50"
            >
              <RotateCcw className={`w-3 h-3 ${restoringDefaults ? 'animate-spin' : ''}`} />
              <span>{restoringDefaults ? 'Checking...' : 'Restore Any Deleted Default Papers'}</span>
            </button>
          </div>
        </div>

        {/* COLLAPSIBLE: 1-CLICK AUTOMATED PUBLISHER */}
        {showAutoPublisher && (
          <div className="p-5 rounded-2xl bg-slate-950/90 border border-emerald-500/30 space-y-5 animate-in fade-in duration-150">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-emerald-400" />
                  <span>Automated Ticker / Topic-to-Publish Pipeline</span>
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Enter any stock ticker or topic to automatically pull live OHLCV quotes, RSI-14, SMA-20/50, and news wires into a draft or live research report.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 text-[11px] font-semibold text-slate-300">
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

            {showAiConfig && (
              <form
                onSubmit={handleSaveAiKeys}
                className="p-4 rounded-2xl bg-slate-900 border border-amber-500/30 space-y-4 text-xs"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      Finnhub Market API Key {aiStatus?.finnhubConfigured && <span className="text-emerald-400">(Active)</span>}
                    </label>
                    <input
                      type="password"
                      value={finnhubKey}
                      onChange={(e) => setFinnhubKey(e.target.value)}
                      placeholder="Quotes, P/E, Analyst Ratings..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      Alpha Vantage API Key {aiStatus?.alphaVantageConfigured && <span className="text-emerald-400">(Active)</span>}
                    </label>
                    <input
                      type="password"
                      value={alphaVantageKey}
                      onChange={(e) => setAlphaVantageKey(e.target.value)}
                      placeholder="Fundamentals, EPS & Sentiment..."
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      OpenAI API Key {aiStatus?.openaiConfigured && <span className="text-emerald-400">(Active)</span>}
                    </label>
                    <input
                      type="password"
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      placeholder="sk-... (GPT-4o Research)"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 font-bold mb-1">
                      Google Gemini Key {aiStatus?.geminiConfigured && <span className="text-emerald-400">(Active)</span>}
                    </label>
                    <input
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder="AIza... (Gemini Flash)"
                      className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white outline-none"
                    />
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={savingKeys}
                    className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold cursor-pointer disabled:opacity-50"
                  >
                    {savingKeys ? 'Saving...' : 'Save & Activate API Keys'}
                  </button>
                </div>
              </form>
            )}

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
                      : 'bg-slate-900 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  {q.label}
                </button>
              ))}
            </div>

            <form onSubmit={handleAutoPublish} className="space-y-3">
              <div className="flex flex-col sm:flex-row gap-3">
                <input
                  type="text"
                  required
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  placeholder="Enter company, stock ticker, crypto or topic (e.g. Apple Inc., AAPL, NVDA, Bitcoin)..."
                  className="flex-1 px-4 py-3 rounded-2xl bg-slate-900 border border-slate-700 focus:border-emerald-500 text-white text-xs font-semibold outline-none"
                />
                <button
                  type="submit"
                  disabled={publishing || !topic.trim()}
                  className="px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 shrink-0"
                >
                  {publishing ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Rocket className="w-4 h-4" />
                      <span>Auto-Generate &amp; Publish</span>
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
                  <span>Include Bull/Bear Sentiment Matrix graphic</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoTrackNews}
                    onChange={(e) => setAutoTrackNews(e.target.checked)}
                    className="rounded border-slate-600 bg-slate-800 text-emerald-500"
                  />
                  <Radio className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Auto-track live breaking news underneath post</span>
                </label>
              </div>
            </form>

            {publishing && (
              <div className="p-3 rounded-xl bg-slate-900 border border-emerald-500/30 text-xs text-emerald-300 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Step {progressStep}/4: Generating institutional report &amp; market data snapshot...</span>
              </div>
            )}

            {lastResult?.post && (
              <div className="p-4 rounded-xl bg-slate-900 border border-emerald-500/40 flex flex-wrap items-center justify-between gap-3 text-xs">
                <span className="text-emerald-400 font-bold">
                  Published: {lastResult.post.title}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(lastResult.post)}
                    className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                  >
                    Edit Article
                  </button>
                  <Link
                    href={`/blog/${lastResult.post.slug}`}
                    target="_blank"
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold inline-flex items-center gap-1"
                  >
                    <span>Open Live</span>
                    <ExternalLink className="w-3 h-3" />
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* ARTICLES & RESEARCH PAPERS DIRECTORY (CRUD TABLE)                    */}
      {/* -------------------------------------------------------------------- */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        {/* Toolbar */}
        <div className="p-5 border-b border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <Newspaper className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <h3 className="text-sm font-black text-white">
                All Institutional Thought Leadership &amp; Research Articles ({filteredPosts.length})
              </h3>
              <p className="text-[11px] text-slate-400">
                Click &ldquo;Edit Article&rdquo; on any row to modify its title, category, tags, author, publish date, read time, or body copy.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Search */}
            <div className="relative min-w-[210px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, author, tag..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-white placeholder:text-slate-500 outline-none focus:border-emerald-500"
              />
            </div>

            {/* Status Filter */}
            {(['ALL', 'PUBLISHED', 'DRAFT', 'FEATURED'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-2 rounded-xl font-bold transition-colors cursor-pointer ${
                  statusFilter === st
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                {st === 'ALL' ? 'All' : st === 'PUBLISHED' ? 'Published' : st === 'DRAFT' ? 'Drafts' : 'Featured'}
              </button>
            ))}

            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-slate-200 font-bold outline-none cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {allCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleSyncAll}
              disabled={syncingAll}
              className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Sync live news on ticker-tracked articles"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingAll ? 'animate-spin' : ''}`} />
              <span>Sync News</span>
            </button>
          </div>
        </div>

        {/* Articles List */}
        {loadingPosts ? (
          <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-emerald-400" />
            <span>Loading institutional research papers...</span>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="py-16 px-4 text-center space-y-3">
            <FileText className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-sm font-bold text-white">No matching articles found</p>
            <p className="text-xs text-slate-400">
              Create a new research paper or clear your current filters.
            </p>
            <button
              type="button"
              onClick={openCreateModal}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
            >
              + Create New Article
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredPosts.map((p) => {
              const parsedTags = (p.tags || '')
                .split(',')
                .map((t) => t.trim())
                .filter(Boolean);
              const thumbUrl =
                resolveMediaUrl(p.coverImage) ||
                resolveMediaUrl(p.bannerSvgUrl) ||
                PRESET_COVERS[0].url;

              return (
                <div
                  key={p.id}
                  className="p-4 sm:p-5 flex flex-col xl:flex-row xl:items-center justify-between gap-4 hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-start gap-4 min-w-0 flex-1">
                    {/* Thumbnail */}
                    <div className="w-24 h-16 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 shrink-0 hidden sm:block">
                      <img
                        src={thumbUrl}
                        alt={p.title}
                        className="w-full h-full object-cover"
                      />
                    </div>

                    <div className="space-y-1.5 min-w-0 flex-1">
                      {/* Badges Row */}
                      <div className="flex flex-wrap items-center gap-2 text-[11px]">
                        <span
                          className={`px-2 py-0.5 rounded-md font-black uppercase ${
                            p.isPublished
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}
                        >
                          {p.isPublished ? 'PUBLISHED' : 'DRAFT'}
                        </span>

                        {p.isFeatured && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-400/20 border border-amber-400/40 text-amber-300 font-bold inline-flex items-center gap-1">
                            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                            <span>Featured Hero</span>
                          </span>
                        )}

                        <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-emerald-300 font-bold">
                          {p.category}
                        </span>

                        <span className="text-slate-400 inline-flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          {formatBlogDate(p.publishedAt)}
                        </span>

                        <span className="text-slate-400 inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {p.readTime || '5 min read'}
                        </span>

                        <span className="text-slate-300 font-semibold inline-flex items-center gap-1">
                          <User className="w-3 h-3 text-emerald-400" />
                          {p.authorName}
                          {p.authorRole ? <span className="text-slate-500">({p.authorRole})</span> : null}
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-sm sm:text-base font-bold text-white leading-snug">
                        {interpolatePlatformTokens(p.title, liveVars)}
                      </h4>

                      {/* Excerpt */}
                      {p.summary && (
                        <p className="text-xs text-slate-400 line-clamp-2">
                          {interpolatePlatformTokens(p.summary, liveVars)}
                        </p>
                      )}

                      {(p.title.includes('{{') || p.summary.includes('{{') || p.content.includes('{{')) && (
                        <div className="text-[10px] font-mono text-cyan-400">
                          Synced with Live Platform Rate Variables
                        </div>
                      )}

                      {/* Tags & Slug */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                        {parsedTags.map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-md bg-slate-950 border border-slate-800 text-[10px] font-semibold text-slate-400"
                          >
                            #{tag}
                          </span>
                        ))}
                        <span className="text-[10px] font-mono text-slate-500 ml-1">
                          /blog/{p.slug}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 text-xs">
                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Article</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTogglePostField(p, 'isPublished')}
                      className={`px-3 py-2 rounded-xl border font-bold flex items-center gap-1.5 cursor-pointer ${
                        p.isPublished
                          ? 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                          : 'bg-emerald-600/20 hover:bg-emerald-600/30 border-emerald-500/40 text-emerald-300'
                      }`}
                      title={p.isPublished ? 'Unpublish to Draft' : 'Publish Live'}
                    >
                      {p.isPublished ? (
                        <>
                          <EyeOff className="w-3.5 h-3.5 text-amber-400" />
                          <span>Unpublish</span>
                        </>
                      ) : (
                        <>
                          <Eye className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Publish</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTogglePostField(p, 'isFeatured')}
                      className={`p-2 rounded-xl border cursor-pointer transition-colors ${
                        p.isFeatured
                          ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                      }`}
                      title={p.isFeatured ? 'Featured Hero Article' : 'Set as Featured Hero Article'}
                    >
                      <Star className={`w-3.5 h-3.5 ${p.isFeatured ? 'fill-amber-400 text-amber-400' : ''}`} />
                    </button>

                    {p.ticker && (
                      <button
                        type="button"
                        onClick={() => handleSyncSingle(p.id)}
                        disabled={syncingId === p.id}
                        className="px-2.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        title="Sync live ticker news"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${syncingId === p.id ? 'animate-spin' : ''}`} />
                      </button>
                    )}

                    <Link
                      href={`/blog/${p.slug}`}
                      target="_blank"
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold inline-flex items-center gap-1"
                    >
                      <span>View</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>

                    <button
                      type="button"
                      onClick={() => handleDeletePost(p)}
                      className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-600 text-rose-400 hover:text-white cursor-pointer transition-colors"
                      title="Delete Article"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* -------------------------------------------------------------------- */}
      {/* FULL ARTICLE CREATE / EDIT MODAL (Scrollable Desktop & Mobile)       */}
      {/* -------------------------------------------------------------------- */}
      {editorOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[120] flex items-center justify-center p-3 sm:p-6">
          <div className="bg-slate-950 border border-slate-800 rounded-3xl max-w-4xl w-full max-h-[92dvh] overflow-y-auto overscroll-contain shadow-2xl text-white flex flex-col">
            {/* Modal Sticky Header */}
            <div className="sticky top-0 z-10 bg-slate-950/95 backdrop-blur-md px-6 py-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-base sm:text-lg font-black text-white flex items-center gap-2">
                  <Edit3 className="w-4 h-4 text-emerald-400" />
                  <span>
                    {editingPostId ? 'Edit Institutional Research Article' : 'Create New Institutional Research Article'}
                  </span>
                </h3>
                <p className="text-[11px] text-slate-400">
                  All changes update the Home Page and <code className="text-emerald-400">/blog</code> Research Directory immediately.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-1 text-xs">
                  <button
                    type="button"
                    onClick={() => setEditorTab('edit')}
                    className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                      editorTab === 'edit' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Edit Fields
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditorTab('preview')}
                    className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                      editorTab === 'preview' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Live Preview
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setEditorOpen(false)}
                  className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {editorError && (
              <div className="mx-6 mt-4 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-bold">
                {editorError}
              </div>
            )}

            {editorTab === 'preview' ? (
              /* LIVE PREVIEW PANE */
              <div className="p-6 sm:p-8 space-y-6">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 font-bold uppercase">
                    {formCategory || 'Market Research'}
                  </span>
                  <span className="text-slate-400">• {formReadTime || estimatedReadTime}</span>
                  <span className="text-slate-400">• {formatBlogDate(formPublishedAt)}</span>
                </div>

                <h1 className="text-2xl sm:text-3xl font-black text-white leading-tight">
                  {interpolatePlatformTokens(formTitle || 'Untitled Research Article', liveVars)}
                </h1>

                {formSummary && (
                  <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                    {interpolatePlatformTokens(formSummary, liveVars)}
                  </p>
                )}

                <div className="flex items-center gap-3 py-3 border-y border-slate-800">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center justify-center">
                    <User className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-white">{formAuthorName || 'Avora Bank Research Team'}</div>
                    <div className="text-[11px] text-slate-400">{formAuthorRole || 'Avora Bank Research Desk'}</div>
                  </div>
                </div>

                {formCoverImage && (
                  <div className="aspect-[16/9] max-h-72 w-full rounded-2xl overflow-hidden border border-slate-800 bg-slate-900">
                    <img
                      src={resolveMediaUrl(formCoverImage) || formCoverImage}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}

                {formKeyTakeaways.trim() && (
                  <div className="p-5 rounded-2xl bg-emerald-950/30 border border-emerald-800/50 space-y-2.5">
                    <div className="text-xs font-black uppercase tracking-wider text-emerald-400">
                      Executive Summary &amp; Key Takeaways
                    </div>
                    <ul className="space-y-1.5 text-xs text-slate-200">
                      {formKeyTakeaways
                        .split(/\r?\n/)
                        .map((l) => interpolatePlatformTokens(l.replace(/^[-*•]\s*/, '').trim(), liveVars))
                        .filter(Boolean)
                        .map((pt, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                            <span>{pt}</span>
                          </li>
                        ))}
                    </ul>
                  </div>
                )}

                <div className="space-y-4 text-sm text-slate-200 leading-relaxed">
                  {interpolatePlatformTokens(formContent, liveVars)
                    .split(/\n\s*\n/)
                    .map((b) => b.trim())
                    .filter(Boolean)
                    .map((block, i) => {
                      if (block.startsWith('## ')) {
                        const nl = block.indexOf('\n');
                        const heading = nl !== -1 ? block.slice(3, nl).trim() : block.slice(3).trim();
                        const rest = nl !== -1 ? block.slice(nl + 1).trim() : '';
                        return (
                          <div key={i} className="space-y-2 pt-2">
                            <h3 className="text-lg font-black text-white">{heading}</h3>
                            {rest && <p>{rest}</p>}
                          </div>
                        );
                      }
                      return <p key={i}>{block}</p>;
                    })}
                </div>

                <div className="flex flex-wrap gap-1.5 pt-4 border-t border-slate-800">
                  {formTags
                    .split(',')
                    .map((t) => t.replace(/^#/, '').trim())
                    .filter(Boolean)
                    .map((tag) => (
                      <span
                        key={tag}
                        className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-300"
                      >
                        #{tag}
                      </span>
                    ))}
                </div>
              </div>
            ) : (
              /* EDIT FORM PANE */
              <form onSubmit={handleSaveArticle} className="p-6 space-y-5 text-xs">
                {/* Title & Slug */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                  <div className="md:col-span-8">
                    <label className="block font-bold text-slate-200 mb-1.5">
                      Article Title *
                    </label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onFocus={() => setActiveEditorField('title')}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormTitle(val);
                        if (!slugManuallyEdited) {
                          setFormSlug(slugifyTitle(val));
                        }
                      }}
                      placeholder="e.g. Why Immutable Double-Entry Ledger Architecture Is the Gold Standard..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white font-bold outline-none"
                    />
                  </div>

                  <div className="md:col-span-4">
                    <label className="block font-bold text-slate-200 mb-1.5">
                      URL Slug (<code className="text-emerald-400">/blog/...</code>)
                    </label>
                    <input
                      type="text"
                      value={formSlug}
                      onChange={(e) => {
                        setSlugManuallyEdited(true);
                        setFormSlug(slugifyTitle(e.target.value));
                      }}
                      placeholder="auto-generated-from-title"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-slate-300 font-mono outline-none"
                    />
                  </div>
                </div>

                {/* Category & Tags */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block font-bold text-slate-200 mb-1.5">
                      Category *
                    </label>
                    <input
                      type="text"
                      required
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      placeholder="e.g. Ledger Security, Global Remittance, Venture Equity..."
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white font-semibold outline-none"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {PRESET_CATEGORIES.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setFormCategory(cat)}
                          className={`px-2 py-1 rounded-lg text-[10px] font-bold border cursor-pointer transition-colors ${
                            formCategory === cat
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-200 mb-1.5 flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Tags (comma-separated)</span>
                    </label>
                    <input
                      type="text"
                      value={formTags}
                      onChange={(e) => setFormTags(e.target.value)}
                      placeholder="Double-Entry Ledger, Zero-Trust Banking, Treasury Security"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white outline-none"
                    />
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {formTags
                        .split(',')
                        .map((t) => t.replace(/^#/, '').trim())
                        .filter(Boolean)
                        .map((tag) => (
                          <span
                            key={tag}
                            className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-300"
                          >
                            #{tag}
                          </span>
                        ))}
                    </div>
                  </div>
                </div>

                {/* Author Name, Author Role, Publish Date & Read Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block font-bold text-slate-200 mb-1.5">
                      Author Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={formAuthorName}
                      onChange={(e) => setFormAuthorName(e.target.value)}
                      placeholder="e.g. Dr. Viktor Kovalenko"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-200 mb-1.5">
                      Author Role / Department
                    </label>
                    <input
                      type="text"
                      value={formAuthorRole}
                      onChange={(e) => setFormAuthorRole(e.target.value)}
                      placeholder="e.g. Chief Ledger Architect, Avora Bank"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-200 mb-1.5">
                      Publish Date *
                    </label>
                    <input
                      type="date"
                      required
                      value={formPublishedAt}
                      onChange={(e) => setFormPublishedAt(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white font-mono outline-none"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="font-bold text-slate-200">Read Time *</label>
                      <button
                        type="button"
                        onClick={() => setFormReadTime(estimatedReadTime)}
                        className="text-[10px] font-bold text-emerald-400 hover:underline cursor-pointer"
                      >
                        Auto ({estimatedReadTime})
                      </button>
                    </div>
                    <input
                      type="text"
                      required
                      value={formReadTime}
                      onChange={(e) => setFormReadTime(e.target.value)}
                      placeholder="e.g. 6 min read"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white outline-none"
                    />
                  </div>
                </div>

                {/* Cover Image URL & Quick Presets */}
                <div>
                  <label className="block font-bold text-slate-200 mb-1.5">
                    Cover Image URL
                  </label>
                  <input
                    type="text"
                    value={formCoverImage}
                    onChange={(e) => setFormCoverImage(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white font-mono outline-none"
                  />
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    <span className="text-[10px] font-bold text-slate-400 mr-1">Presets:</span>
                    {PRESET_COVERS.map((c) => (
                      <button
                        key={c.label}
                        type="button"
                        onClick={() => setFormCoverImage(c.url)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                          formCoverImage === c.url
                            ? 'bg-emerald-600 text-white border-emerald-500'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                        }`}
                      >
                        {c.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Executive Summary / Excerpt */}
                <div>
                  <label className="block font-bold text-slate-200 mb-1.5">
                    Executive Summary / Card Excerpt *
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={formSummary}
                    onFocus={() => setActiveEditorField('summary')}
                    onChange={(e) => setFormSummary(e.target.value)}
                    placeholder="Short 1-2 sentence executive summary displayed on article cards and underneath the headline..."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white outline-none leading-relaxed"
                  />
                </div>

                {/* Key Takeaways */}
                <div>
                  <label className="block font-bold text-slate-200 mb-1.5">
                    Key Quantitative Takeaways (Optional — one bullet point per line)
                  </label>
                  <textarea
                    rows={3}
                    value={formKeyTakeaways}
                    onFocus={() => setActiveEditorField('takeaways')}
                    onChange={(e) => setFormKeyTakeaways(e.target.value)}
                    placeholder={
                      'Every transaction generates balanced debit and credit journal entries.\nBalances record before-and-after snapshots with cryptographic idempotency keys.'
                    }
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white outline-none leading-relaxed"
                  />
                </div>

                {/* Live Platform Variables Helper Bar */}
                <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-cyan-500/30 space-y-2.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="text-[11px] font-black uppercase tracking-wider text-cyan-400">
                        Insert Live Platform Rate Variable (Auto-Updates When Admin Settings Change)
                      </span>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        Click a variable below to append it to your{' '}
                        <strong className="text-white uppercase">{activeEditorField}</strong> field. Example:{' '}
                        <code className="text-emerald-400">{'{{fx_margin}}'}</code> currently renders as{' '}
                        <strong className="text-emerald-300">{liveVars.fx_margin || '2%'}</strong>.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowTokenPicker((v) => !v)}
                      className="text-[10px] font-bold text-slate-400 hover:text-white cursor-pointer"
                    >
                      {showTokenPicker ? 'Collapse Variables' : 'Show Variables'}
                    </button>
                  </div>

                  {showTokenPicker && (
                    <div className="flex flex-wrap gap-1.5">
                      {(tokenCatalog.length > 0
                        ? tokenCatalog
                        : [
                            { token: '{{fx_margin}}', key: 'fx_margin', label: 'FX Margin', group: 'Remittance' },
                            { token: '{{transfer_fee}}', key: 'transfer_fee', label: 'Transfer Fee', group: 'Remittance' },
                            { token: '{{corridors_count}}', key: 'corridors_count', label: 'Corridors', group: 'Remittance' },
                            { token: '{{fee_model_slash}}', key: 'fee_model_slash', label: 'Startup Split', group: 'Venture' },
                            { token: '{{allocation_fee}}', key: 'allocation_fee', label: 'Allocation Fee', group: 'Venture' },
                            { token: '{{profit_share_fee}}', key: 'profit_share_fee', label: 'Profit Share', group: 'Venture' },
                            { token: '{{monthly_return_decimal}}', key: 'monthly_return_decimal', label: 'FD Yield', group: 'FD' },
                            { token: '{{lock_in_months}}', key: 'lock_in_months', label: 'Lock Months', group: 'FD' },
                            { token: '{{package_min}}', key: 'package_min', label: 'Min Package', group: 'FD' },
                            { token: '{{package_max}}', key: 'package_max', label: 'Max Package', group: 'FD' },
                            { token: '{{otc_total_fee}}', key: 'otc_total_fee', label: 'OTC Fee', group: 'OTC' },
                            { token: '{{otc_deposit}}', key: 'otc_deposit', label: 'OTC Deposit', group: 'OTC' },
                            { token: '{{p2p_deposit}}', key: 'p2p_deposit', label: 'P2P Deposit', group: 'P2P' },
                          ]
                      ).map((item) => (
                        <button
                          key={item.token}
                          type="button"
                          onClick={() => insertTokenIntoActiveField(item.token)}
                          title={`${item.label} (${item.group}) -> Current live value: ${liveVars[item.key] || ''}`}
                          className="px-2 py-1 rounded-lg bg-slate-950 hover:bg-cyan-500/15 border border-slate-800 hover:border-cyan-500/40 text-[10px] font-mono text-slate-300 hover:text-cyan-300 cursor-pointer flex items-center gap-1 transition-colors"
                        >
                          <span className="font-bold text-cyan-400">{item.token}</span>
                          <span className="text-slate-500">({liveVars[item.key] || '—'})</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Main Article Body Copy */}
                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                    <label className="font-bold text-slate-200">
                      Article Body Copy * (Separate paragraphs with a blank line; prefix subheadings with <code className="text-emerald-400">## Heading</code>)
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setFormContent((prev) =>
                            `${prev ? `${prev.trim()}\n\n` : ''}## Section Heading\nWrite section analysis here...`
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-emerald-400 font-bold text-[11px] cursor-pointer"
                      >
                        + Add Section Heading (##)
                      </button>
                      <span className="text-[11px] font-mono text-slate-400">
                        {wordCount} words • ~{estimatedReadTime}
                      </span>
                    </div>
                  </div>
                  <textarea
                    rows={12}
                    required
                    value={formContent}
                    onFocus={() => setActiveEditorField('content')}
                    onChange={(e) => setFormContent(e.target.value)}
                    placeholder={
                      'Write or paste your full article body copy here...\n\n## Architectural Overview\nSeparate paragraphs with a blank line to format clean institutional sections.'
                    }
                    className="w-full px-4 py-3 rounded-2xl bg-slate-900 border border-slate-800 focus:border-emerald-500 text-white outline-none leading-relaxed font-sans text-sm"
                  />
                </div>

                {/* Publish Status & Featured Controls */}
                <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
                  <div className="flex flex-wrap items-center gap-6">
                    <label className="inline-flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsPublished}
                        onChange={(e) => setFormIsPublished(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-emerald-500"
                      />
                      <div>
                        <span className="font-bold text-white block">Publish Live on Website</span>
                        <span className="text-[11px] text-slate-400">
                          Uncheck to save as a private Draft
                        </span>
                      </div>
                    </label>

                    <label className="inline-flex items-center gap-2.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsFeatured}
                        onChange={(e) => setFormIsFeatured(e.target.checked)}
                        className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-amber-500"
                      />
                      <div>
                        <span className="font-bold text-amber-300 block">Feature in /blog Hero Spotlight</span>
                        <span className="text-[11px] text-slate-400">
                          Highlights this paper at the top of the Research Directory
                        </span>
                      </div>
                    </label>
                  </div>

                  <div className="flex items-center gap-3 ml-auto">
                    <button
                      type="button"
                      onClick={() => setEditorOpen(false)}
                      className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={savingArticle}
                      className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-black flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-950/50 disabled:opacity-50"
                    >
                      {savingArticle && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>
                        {savingArticle
                          ? 'Saving...'
                          : editingPostId
                          ? 'Save Article Changes'
                          : formIsPublished
                          ? 'Publish Article Now'
                          : 'Save Draft'}
                      </span>
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
