'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { api } from '../../../lib/api';
import { BLOG_POSTS_DATA, BlogPostItem, formatBlogDate } from '../../../lib/blog-data';
import {
  ArrowLeft,
  Clock,
  Calendar,
  CheckCircle2,
  Sparkles,
  ArrowRight,
  User,
} from 'lucide-react';

export default function BlogPostDetailPage() {
  const params = useParams();
  const slug = typeof params?.slug === 'string' ? params.slug : Array.isArray(params?.slug) ? params.slug[0] : '';

  const [post, setPost] = useState<BlogPostItem | null>(() => {
    return BLOG_POSTS_DATA.find((b) => b.slug === slug) || null;
  });

  useEffect(() => {
    if (!slug) return;
    const foundStatic = BLOG_POSTS_DATA.find((b) => b.slug === slug);
    if (foundStatic) {
      setPost(foundStatic);
    }

    api
      .get(`/cms/blogs/${slug}`)
      .then((res) => {
        const b = res.data?.blog;
        if (b) {
          setPost({
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
            tags: Array.isArray(b.tags)
              ? b.tags
              : typeof b.tags === 'string'
              ? b.tags.split(',').map((t: string) => t.trim())
              : ['Avora Bank', 'Research'],
            content:
              typeof b.content === 'string'
                ? b.content.split('\n\n')
                : foundStatic?.content || [],
            keyTakeaways: foundStatic?.keyTakeaways || [],
          });
        }
      })
      .catch(() => {
        // Keep static post
      });
  }, [slug]);

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

  const relatedPosts = BLOG_POSTS_DATA.filter((p) => p.slug !== post.slug).slice(0, 3);

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

      {/* Key Takeaways Box */}
      {post.keyTakeaways && post.keyTakeaways.length > 0 && (
        <div className="p-6 sm:p-8 rounded-3xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 space-y-4">
          <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <Sparkles className="w-4 h-4" />
            <span>Executive Summary &amp; Key Takeaways</span>
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

      {/* Main Article Body */}
      <div className="space-y-6 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
        {post.content.map((paragraph, index) => (
          <p key={index} className="leading-relaxed">
            {paragraph}
          </p>
        ))}
      </div>

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

