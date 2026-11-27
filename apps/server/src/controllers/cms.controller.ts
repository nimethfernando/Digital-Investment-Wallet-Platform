import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { cmsService } from '../services/cms.service';
import { autoContentService, extractEditorialTopicAndBrief } from '../services/autoContent.service';
import { prisma } from '../lib/prisma';
import { InquiryType } from '@prisma/client';

const inquirySchema = z.object({
  type: z.nativeEnum(InquiryType),
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  subject: z.string().min(3, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

const newsletterSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const subscribeNewsletter = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = newsletterSchema.parse(req.body);
    const result = await cmsService.subscribeNewsletter(email);
    res.json(result);
  } catch (err) {
    next(err);
  }
};

export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    if (!req.user) {
      const guestSettings = await cmsService.getGuestPublicSettings();
      return res.json({ success: true, settings: guestSettings, variables: {} });
    }
    const [settings, variables] = await Promise.all([
      cmsService.getPublicSettings(),
      cmsService.getPlatformTemplateVars(),
    ]);
    res.json({ success: true, settings, variables });
  } catch (err) {
    next(err);
  }
};

export const getPlatformVariables = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const [variables, settings] = await Promise.all([
      cmsService.getPlatformTemplateVars(),
      cmsService.getPublicSettings(),
    ]);
    res.json({
      success: true,
      variables,
      catalog: cmsService.getBlogTemplateTokensCatalog(),
      settings,
    });
  } catch (err) {
    next(err);
  }
};

export const updateSetting = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { key, value, group } = req.body;
    if (!key || value === undefined) {
      return res.status(400).json({ success: false, message: 'Key and value are required' });
    }
    const updated = await cmsService.updateSetting(key, String(value), group);
    res.json({ success: true, updated });
  } catch (err) {
    next(err);
  }
};

export const getPageSections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    const page = String(req.params.page || '').toUpperCase();
    const guestAllowedPages = new Set(['ABOUT', 'CONTACT']);
    if (!req.user && !guestAllowedPages.has(page)) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required to access internal page sections.',
      });
    }
    const sections = await cmsService.getPageSections(page);
    res.json({ success: true, sections });
  } catch (err) {
    next(err);
  }
};

export const getAllSections = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sections = await cmsService.getAllSections();
    res.json({ success: true, sections });
  } catch (err) {
    next(err);
  }
};

export const updateSection = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { title, subtitle, content, metadata, isActive } = req.body;
    const updated = await cmsService.updateSection(id, { title, subtitle, content, metadata, isActive });
    res.json({ success: true, updated });
  } catch (err) {
    next(err);
  }
};

export const submitInquiry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = inquirySchema.parse(req.body);
    const userId = req.user?.userId;
    const inquiry = await cmsService.submitInquiry({ ...data, userId });
    res.status(201).json({ success: true, message: 'Inquiry submitted successfully', inquiryId: inquiry.id });
  } catch (err) {
    next(err);
  }
};

export const getInquiries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const result = await cmsService.getInquiries(page, limit);
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

export const getMyInquiries = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ success: false, message: 'Unauthorized' });
    const tickets = await cmsService.getUserInquiries(userId);
    res.json({ success: true, tickets });
  } catch (err) {
    next(err);
  }
};

export const updateInquiryStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const { status, adminNotes } = req.body;
    const updated = await cmsService.updateInquiryStatus(id, status, adminNotes);
    res.json({ success: true, updated });
  } catch (err) {
    next(err);
  }
};

export const getBlogPosts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    // Trigger background freshness & autonomous publishing check without blocking page render
    autoContentService.runScheduledFreshnessIfDue().catch(() => {});
    const blogs = await cmsService.getBlogPosts();
    res.json({ success: true, blogs });
  } catch (err) {
    next(err);
  }
};

export const getBlogPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const slug = req.params.slug as string;
    const includeDrafts = req.query.preview === 'true';
    const raw = req.query.raw === 'true';
    let blog = await cmsService.getBlogPostBySlug(slug, includeDrafts, raw);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog post not found' });

    // Stale auto-refresh if auto-tracked and last sync was > 15 mins ago (keeps continuous news & quotes fresh)
    const fifteenMinsAgo = Date.now() - 15 * 60 * 1000;
    if (
      blog.autoTrackNews &&
      blog.ticker &&
      (!blog.lastNewsSync || new Date(blog.lastNewsSync).getTime() < fifteenMinsAgo)
    ) {
      try {
        const synced = await autoContentService.syncPostNews(blog.id);
        if (synced?.post) blog = synced.post as any;
      } catch {
        // serve existing cached content if external news fetch times out
      }
    }

    res.json({ success: true, blog });
  } catch (err) {
    next(err);
  }
};

export const getBlogBannerMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawSlug = String(req.params.slug || '').replace(/\.svg$/i, '');
    const post = await prisma.blogPost.findUnique({
      where: { slug: rawSlug },
      select: { slug: true, title: true, bannerData: true },
    });
    const svg = autoContentService.renderBannerSvg(rawSlug, post?.bannerData, post?.title);
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate');
    res.send(svg);
  } catch (err) {
    next(err);
  }
};

export const getBlogMemeMedia = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawSlug = String(req.params.slug || '').replace(/\.svg$/i, '');
    const post = await prisma.blogPost.findUnique({
      where: { slug: rawSlug },
      select: { ticker: true, memeData: true },
    });
    const svg = autoContentService.renderMemeSvg(post?.memeData, post?.ticker || 'MARKET');
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, max-age=0, must-revalidate');
    res.send(svg);
  } catch (err) {
    next(err);
  }
};

export const autoPublishBlog = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { topic, customPrompt, includeMeme, autoTrackNews, categoryOverride } = req.body;
    const { topic: derivedTopic, brief: derivedPrompt } = extractEditorialTopicAndBrief(
      typeof topic === 'string' ? topic : '',
      typeof customPrompt === 'string' ? customPrompt : ''
    );

    if (!derivedTopic || derivedTopic.length < 2) {
      return res.status(400).json({ success: false, message: 'Please enter a valid blog topic, ticker, or AI prompt.' });
    }

    const result = await autoContentService.publishAutomatedPost({
      topic: derivedTopic,
      customPrompt: derivedPrompt || undefined,
      includeMeme: includeMeme !== false,
      autoTrackNews: autoTrackNews !== false,
      categoryOverride: typeof categoryOverride === 'string' && categoryOverride.trim() ? categoryOverride.trim() : undefined,
    });

    res.status(201).json({
      success: true,
      message: `Published automated briefing for ${result.stats.companyName} (${result.stats.tickerResolved}) with ${result.stats.newsGathered} live news updates.`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

export const syncBlogNewsAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const result = await autoContentService.syncPostNews(id, true);
    if (!result) {
      return res.status(404).json({ success: false, message: 'Tracked blog post not found.' });
    }
    res.json({
      success: true,
      message: `Updated quantitative report & synced ${result.addedCount} new headline(s) for ${result.post.ticker || result.post.slug}.`,
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

export const syncAllTrackedBlogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const forceRegen = req.query.force === 'true';
    const summary = await autoContentService.syncAllTrackedPosts(forceRegen);
    res.json({ success: true, ...summary });
  } catch (err) {
    next(err);
  }
};

export const triggerAutonomousFreshPublish = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { customPrompt } = req.body || {};
    const result = await autoContentService.runAutonomousFreshPublisher(
      true,
      typeof customPrompt === 'string' && customPrompt.trim() ? customPrompt.trim() : undefined
    );
    res.status(201).json({
      success: true,
      message: result.published
        ? `Published fresh AI announcement for ${(result as any).stats?.companyName || result.topic} (${(result as any).stats?.tickerResolved || result.topic}).`
        : 'Autonomous publisher skipped.',
      ...result,
    });
  } catch (err) {
    next(err);
  }
};

export const getAdminBlogPosts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const blogs = await cmsService.getBlogPosts(true);
    res.json({ success: true, blogs });
  } catch (err) {
    next(err);
  }
};

export const createAdminBlogPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const blog = await cmsService.createBlogPost(req.body || {});
    res.status(201).json({
      success: true,
      message: `Article "${blog.title}" created successfully.`,
      blog,
    });
  } catch (err: any) {
    if (err?.message && (err.message.includes('required') || err.message.includes('already used'))) {
      return res.status(400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

export const updateAdminBlogPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const updated = await cmsService.updateBlogPost(id, req.body || {});
    res.json({
      success: true,
      message: `Article "${updated.title}" updated successfully.`,
      blog: updated,
    });
  } catch (err: any) {
    if (err?.message && (err.message.includes('not found') || err.message.includes('empty') || err.message.includes('already used'))) {
      return res.status(err.message.includes('not found') ? 404 : 400).json({ success: false, message: err.message });
    }
    next(err);
  }
};

export const deleteAdminBlogPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    await cmsService.deleteBlogPost(id);
    res.json({ success: true, message: 'Article deleted.' });
  } catch (err) {
    next(err);
  }
};

export const seedDefaultBlogPostsAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const restoredCount = await cmsService.ensureDefaultBlogPosts(true);
    const updatedTokensCount = await cmsService.migrateSeededArticlesToDynamicTokens(true);
    const blogs = await cmsService.getBlogPosts(true);
    res.json({
      success: true,
      restoredCount,
      updatedTokensCount,
      message:
        restoredCount > 0 || updatedTokensCount > 0
          ? `Restored ${restoredCount} default paper(s) & synced ${updatedTokensCount} paper(s) with live rate tokens.`
          : 'All default institutional research papers are present and synced.',
      blogs,
    });
  } catch (err) {
    next(err);
  }
};

export const syncBlogTokensAdmin = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updatedTokensCount = await cmsService.migrateSeededArticlesToDynamicTokens(true);
    const blogs = await cmsService.getBlogPosts(true);
    res.json({
      success: true,
      updatedTokensCount,
      message:
        updatedTokensCount > 0
          ? `Converted ${updatedTokensCount} article(s) to live dynamic rate tokens.`
          : 'All default articles are already using live dynamic rate tokens.',
      blogs,
    });
  } catch (err) {
    next(err);
  }
};

export const getAiPublisherConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const status = await autoContentService.getPublicAiStatus();
    res.json({ success: true, status });
  } catch (err) {
    next(err);
  }
};

export const saveAiPublisherConfig = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    const {
      openaiApiKey,
      geminiApiKey,
      finnhubApiKey,
      alphaVantageApiKey,
      clearOpenaiKey,
      clearGeminiKey,
      clearFinnhubKey,
      clearAlphaVantageKey,
      autoPublishEnabled,
      autoPublishIntervalHours,
      autoPublishTopics,
    } = req.body;
    const status = await autoContentService.saveAiConfig({
      openaiApiKey,
      geminiApiKey,
      finnhubApiKey,
      alphaVantageApiKey,
      clearOpenaiKey: Boolean(clearOpenaiKey),
      clearGeminiKey: Boolean(clearGeminiKey),
      clearFinnhubKey: Boolean(clearFinnhubKey),
      clearAlphaVantageKey: Boolean(clearAlphaVantageKey),
      autoPublishEnabled,
      autoPublishIntervalHours,
      autoPublishTopics,
    });
    res.json({ success: true, status, message: `Saved configuration. Active Engine: ${status.engineMode}` });
  } catch (err) {
    next(err);
  }
};
