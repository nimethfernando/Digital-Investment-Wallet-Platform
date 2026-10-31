'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '../../lib/api';
import { BLOG_POSTS_DATA, BlogPostItem, formatBlogDate } from '../../lib/blog-data';
import {
  ArrowRight,
  Clock,
  Calendar,
  Search,
  Sparkles,
  BookOpen,
} from 'lucide-react';

export default function BlogListingPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<BlogPostItem[]>(BLOG_POSTS_DATA);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeTag, setActiveTag] = useState<string>('');

  useEffect(() => {
    api
      .get('/cms/blogs')
      .then((res) => {
        if (Array.isArray(res.data?.blogs) && res.data.blogs.length > 0) {
          const mapped: BlogPostItem[] = res.data.blogs.map((b: any) => ({
            id: b.id,
            slug: b.slug,
            title: b.title,
            excerpt: b.excerpt || b.summary || '',
            category: b.category || 'Treasury & Yield',
            readTime: b.readTime || '5 min read',
            publishedAt: b.publishedAt || b.createdAt || '2026-10-20',
            authorName: b.author || 'Avora Institutional Research',
            authorRole: 'Avora Bank Research Desk',
            coverImage:
              b.coverImage ||
              'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=1200&q=80',
            isFeatured: Boolean(b.isFeatured),
            tags: Array.isArray(b.tags)
              ? b.tags
              : typeof b.tags === 'string'
              ? b.tags.split(',').map((t: string) => t.trim())
              : ['Avora Bank', 'Research'],
            content: typeof b.content === 'string' ? b.content.split('\n\n') : [],
            keyTakeaways: [],
          }));
          // Combine DB blogs with static blogs (avoiding duplicate slugs)
          const existingSlugs = new Set(mapped.map((m) => m.slug));
          const merged = [
            ...mapped,
            ...BLOG_POSTS_DATA.filter((item) => !existingSlugs.has(item.slug)),
          ];
          setPosts(merged);
        }
      })
      .catch(() => {
        // Fallback to BLOG_POSTS_DATA
      });
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    posts.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['all', ...Array.from(set)];
  }, [posts]);

  const filteredPosts = useMemo(() => {
    return posts.filter((post) => {
      const matchesCategory =
        selectedCategory === 'all' ||
        post.category?.toLowerCase() === selectedCategory.toLowerCase();

      const q = searchQuery.toLowerCase().trim();
      const matchesTag =
        !activeTag ||
        post.tags.some(
          (t) => t.replace(/^#/, '').toLowerCase() === activeTag.toLowerCase().trim()
        );

      const matchesQuery =
        !q ||
        post.title.toLowerCase().includes(q) ||
        post.excerpt.toLowerCase().includes(q) ||
        post.category.toLowerCase().includes(q) ||
        post.tags.some((t) => t.toLowerCase().includes(q));

      return matchesCategory && matchesQuery && matchesTag;
    });
  }, [posts, selectedCategory, searchQuery, activeTag]);

  const featuredPost = useMemo(() => {
    return posts.find((p) => p.isFeatured) || posts[0];
  }, [posts]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-12">
      {/* Page Header */}
      <div className="text-center max-w-3xl mx-auto space-y-4">
        <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" /> Avora Bank Research &amp; Insights
        </div>
        <h1 className="text-3xl sm:text-5xl font-black text-slate-900 dark:text-white tracking-tight">
          Institutional Thought Leadership &amp; Market Papers
        </h1>
        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed">
          In-depth architectural breakdowns, cross-border FX liquidity reports, venture crowdfunding structures, and treasury risk papers published by Avora Bank’s research desk.
        </p>
      </div>

      {/* Featured Research Hero Card */}
      {!searchQuery && selectedCategory === 'all' && !activeTag && featuredPost && (
        <div className="rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-950 via-slate-900 to-emerald-950 p-6 sm:p-10 lg:p-12 relative overflow-hidden shadow-2xl">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-6 relative aspect-[16/10] rounded-2xl overflow-hidden shadow-xl bg-slate-900">
              <img
                src={featuredPost.coverImage}
                alt={featuredPost.title}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute top-4 left-4">
                <span className="px-3 py-1 rounded-full bg-emerald-600 text-white text-xs font-bold uppercase tracking-wider shadow-md">
                  Featured Research
                </span>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-4 text-white">
              <div className="flex flex-wrap items-center gap-3 text-xs text-emerald-300">
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold uppercase">
                  {featuredPost.category}
                </span>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {featuredPost.readTime}
                </span>
                <span>•</span>
                <span>{formatBlogDate(featuredPost.publishedAt)}</span>
              </div>

              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight tracking-tight">
                <Link
                  href={`/blog/${featuredPost.slug}`}
                  className="hover:text-emerald-400 transition-colors"
                >
                  {featuredPost.title}
                </Link>
              </h2>

              <p className="text-sm sm:text-base text-slate-300 line-clamp-3 leading-relaxed">
                {featuredPost.excerpt}
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <div className="text-sm font-bold text-white">{featuredPost.authorName}</div>
                  <div className="text-xs text-slate-400">{featuredPost.authorRole}</div>
                </div>

                <Link
                  href={`/blog/${featuredPost.slug}`}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-2 shadow-lg transition-all"
                >
                  <span>Read Full Paper</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => {
                setSelectedCategory(cat);
                setActiveTag('');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold capitalize transition-all cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
            >
              {cat === 'all' ? 'All Articles' : cat}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search research & insights..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Active Tag Pill */}
      {activeTag && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Filtered by tag:</span>
          <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold border border-emerald-500/20">
            #{activeTag}
          </span>
          <button
            onClick={() => setActiveTag('')}
            className="text-rose-500 hover:underline font-semibold"
          >
            Clear
          </button>
        </div>
      )}

      {/* 3-Column Blog Grid */}
      {filteredPosts.length === 0 ? (
        <div className="text-center py-16 rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
          <BookOpen className="w-10 h-10 text-slate-400 mx-auto" />
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            No matching articles found
          </h3>
          <p className="text-xs text-slate-500">
            Try clearing your search filter or selecting another research category.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {filteredPosts.map((post) => (
            <article
              key={post.id}
              onClick={() => router.push(`/blog/${post.slug}`)}
              className="group rounded-3xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden flex flex-col justify-between hover:shadow-2xl hover:border-emerald-500/50 transition-all duration-300 cursor-pointer"
            >
              <div>
                {/* Cover Image */}
                <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-900">
                  <img
                    src={post.coverImage}
                    alt={post.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity" />

                  <div className="absolute top-4 left-4">
                    <span className="px-3 py-1 rounded-full bg-emerald-600/95 text-white text-[11px] font-bold tracking-wide shadow-md backdrop-blur-xs">
                      {post.category}
                    </span>
                  </div>

                  <div className="absolute bottom-3 right-3 flex items-center gap-1 px-2.5 py-1 rounded-md bg-slate-950/80 text-white text-[11px] font-medium backdrop-blur-xs">
                    <Clock className="w-3 h-3 text-emerald-400" />
                    <span>{post.readTime}</span>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-6 space-y-3.5">
                  <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                    <Calendar className="w-3.5 h-3.5 text-emerald-500" />
                    <span>{formatBlogDate(post.publishedAt)}</span>
                  </div>

                  <h3 className="text-lg font-bold text-slate-900 dark:text-white group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors line-clamp-2 leading-snug">
                    {post.title}
                  </h3>

                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-3 leading-relaxed">
                    {post.excerpt}
                  </p>
                </div>
              </div>

              {/* Card Footer */}
              <div className="px-6 pb-6 pt-3 border-t border-slate-100 dark:border-slate-800/80 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {post.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveTag(tag);
                      }}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-500 transition-colors"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    {post.authorName}
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-600 dark:text-emerald-400 group-hover:translate-x-1 transition-transform">
                    Read Article <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

