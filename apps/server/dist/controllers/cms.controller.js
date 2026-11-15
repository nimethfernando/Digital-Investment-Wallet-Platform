"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveAiPublisherConfig = exports.getAiPublisherConfig = exports.deleteAdminBlogPost = exports.updateAdminBlogPost = exports.getAdminBlogPosts = exports.syncAllTrackedBlogs = exports.syncBlogNewsAdmin = exports.autoPublishBlog = exports.getBlogMemeMedia = exports.getBlogBannerMedia = exports.getBlogPost = exports.getBlogPosts = exports.updateInquiryStatus = exports.getMyInquiries = exports.getInquiries = exports.submitInquiry = exports.updateSection = exports.getAllSections = exports.getPageSections = exports.updateSetting = exports.getSettings = exports.subscribeNewsletter = void 0;
const zod_1 = require("zod");
const cms_service_1 = require("../services/cms.service");
const autoContent_service_1 = require("../services/autoContent.service");
const prisma_1 = require("../lib/prisma");
const client_1 = require("@prisma/client");
const inquirySchema = zod_1.z.object({
    type: zod_1.z.nativeEnum(client_1.InquiryType),
    name: zod_1.z.string().min(2, 'Name is required'),
    email: zod_1.z.string().email('Valid email is required'),
    phone: zod_1.z.string().optional(),
    subject: zod_1.z.string().min(3, 'Subject is required'),
    message: zod_1.z.string().min(10, 'Message must be at least 10 characters'),
});
const newsletterSchema = zod_1.z.object({
    email: zod_1.z.string().email('Please enter a valid email address'),
});
const subscribeNewsletter = async (req, res, next) => {
    try {
        const { email } = newsletterSchema.parse(req.body);
        const result = await cms_service_1.cmsService.subscribeNewsletter(email);
        res.json(result);
    }
    catch (err) {
        next(err);
    }
};
exports.subscribeNewsletter = subscribeNewsletter;
const getSettings = async (req, res, next) => {
    try {
        const settings = await cms_service_1.cmsService.getPublicSettings();
        res.json({ success: true, settings });
    }
    catch (err) {
        next(err);
    }
};
exports.getSettings = getSettings;
const updateSetting = async (req, res, next) => {
    try {
        const { key, value, group } = req.body;
        if (!key || value === undefined) {
            return res.status(400).json({ success: false, message: 'Key and value are required' });
        }
        const updated = await cms_service_1.cmsService.updateSetting(key, String(value), group);
        res.json({ success: true, updated });
    }
    catch (err) {
        next(err);
    }
};
exports.updateSetting = updateSetting;
const getPageSections = async (req, res, next) => {
    try {
        const page = req.params.page;
        const sections = await cms_service_1.cmsService.getPageSections(page);
        res.json({ success: true, sections });
    }
    catch (err) {
        next(err);
    }
};
exports.getPageSections = getPageSections;
const getAllSections = async (req, res, next) => {
    try {
        const sections = await cms_service_1.cmsService.getAllSections();
        res.json({ success: true, sections });
    }
    catch (err) {
        next(err);
    }
};
exports.getAllSections = getAllSections;
const updateSection = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { title, subtitle, content, metadata, isActive } = req.body;
        const updated = await cms_service_1.cmsService.updateSection(id, { title, subtitle, content, metadata, isActive });
        res.json({ success: true, updated });
    }
    catch (err) {
        next(err);
    }
};
exports.updateSection = updateSection;
const submitInquiry = async (req, res, next) => {
    try {
        const data = inquirySchema.parse(req.body);
        const userId = req.user?.userId;
        const inquiry = await cms_service_1.cmsService.submitInquiry({ ...data, userId });
        res.status(201).json({ success: true, message: 'Inquiry submitted successfully', inquiryId: inquiry.id });
    }
    catch (err) {
        next(err);
    }
};
exports.submitInquiry = submitInquiry;
const getInquiries = async (req, res, next) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const result = await cms_service_1.cmsService.getInquiries(page, limit);
        res.json({ success: true, ...result });
    }
    catch (err) {
        next(err);
    }
};
exports.getInquiries = getInquiries;
const getMyInquiries = async (req, res, next) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ success: false, message: 'Unauthorized' });
        const tickets = await cms_service_1.cmsService.getUserInquiries(userId);
        res.json({ success: true, tickets });
    }
    catch (err) {
        next(err);
    }
};
exports.getMyInquiries = getMyInquiries;
const updateInquiryStatus = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { status, adminNotes } = req.body;
        const updated = await cms_service_1.cmsService.updateInquiryStatus(id, status, adminNotes);
        res.json({ success: true, updated });
    }
    catch (err) {
        next(err);
    }
};
exports.updateInquiryStatus = updateInquiryStatus;
const getBlogPosts = async (req, res, next) => {
    try {
        const blogs = await cms_service_1.cmsService.getBlogPosts();
        res.json({ success: true, blogs });
    }
    catch (err) {
        next(err);
    }
};
exports.getBlogPosts = getBlogPosts;
const getBlogPost = async (req, res, next) => {
    try {
        const slug = req.params.slug;
        let blog = await cms_service_1.cmsService.getBlogPostBySlug(slug);
        if (!blog)
            return res.status(404).json({ success: false, message: 'Blog post not found' });
        // Stale auto-refresh if auto-tracked and last sync was > 30 mins ago (keeps continuous news fresh even on serverless)
        const thirtyMinsAgo = Date.now() - 30 * 60 * 1000;
        if (blog.autoTrackNews &&
            blog.ticker &&
            (!blog.lastNewsSync || new Date(blog.lastNewsSync).getTime() < thirtyMinsAgo)) {
            try {
                const synced = await autoContent_service_1.autoContentService.syncPostNews(blog.id);
                if (synced?.post)
                    blog = synced.post;
            }
            catch {
                // serve existing cached content if external news fetch times out
            }
        }
        res.json({ success: true, blog });
    }
    catch (err) {
        next(err);
    }
};
exports.getBlogPost = getBlogPost;
const getBlogBannerMedia = async (req, res, next) => {
    try {
        const rawSlug = String(req.params.slug || '').replace(/\.svg$/i, '');
        const post = await prisma_1.prisma.blogPost.findUnique({
            where: { slug: rawSlug },
            select: { slug: true, title: true, bannerData: true },
        });
        const svg = autoContent_service_1.autoContentService.renderBannerSvg(rawSlug, post?.bannerData, post?.title);
        res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(svg);
    }
    catch (err) {
        next(err);
    }
};
exports.getBlogBannerMedia = getBlogBannerMedia;
const getBlogMemeMedia = async (req, res, next) => {
    try {
        const rawSlug = String(req.params.slug || '').replace(/\.svg$/i, '');
        const post = await prisma_1.prisma.blogPost.findUnique({
            where: { slug: rawSlug },
            select: { ticker: true, memeData: true },
        });
        const svg = autoContent_service_1.autoContentService.renderMemeSvg(post?.memeData, post?.ticker || 'MARKET');
        res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=300');
        res.send(svg);
    }
    catch (err) {
        next(err);
    }
};
exports.getBlogMemeMedia = getBlogMemeMedia;
const autoPublishBlog = async (req, res, next) => {
    try {
        const { topic, includeMeme, autoTrackNews, categoryOverride } = req.body;
        if (!topic || typeof topic !== 'string' || topic.trim().length < 2) {
            return res.status(400).json({ success: false, message: 'Please enter a valid stock ticker or topic.' });
        }
        const result = await autoContent_service_1.autoContentService.publishAutomatedPost({
            topic: topic.trim(),
            includeMeme: includeMeme !== false,
            autoTrackNews: autoTrackNews !== false,
            categoryOverride: typeof categoryOverride === 'string' && categoryOverride.trim() ? categoryOverride.trim() : undefined,
        });
        res.status(201).json({
            success: true,
            message: `Published automated briefing for ${result.stats.companyName} (${result.stats.tickerResolved}) with ${result.stats.newsGathered} live news updates.`,
            ...result,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.autoPublishBlog = autoPublishBlog;
const syncBlogNewsAdmin = async (req, res, next) => {
    try {
        const id = req.params.id;
        const result = await autoContent_service_1.autoContentService.syncPostNews(id, true);
        if (!result) {
            return res.status(404).json({ success: false, message: 'Tracked blog post not found.' });
        }
        res.json({
            success: true,
            message: `Updated quantitative report & synced ${result.addedCount} new headline(s) for ${result.post.ticker || result.post.slug}.`,
            ...result,
        });
    }
    catch (err) {
        next(err);
    }
};
exports.syncBlogNewsAdmin = syncBlogNewsAdmin;
const syncAllTrackedBlogs = async (req, res, next) => {
    try {
        const summary = await autoContent_service_1.autoContentService.syncAllTrackedPosts();
        res.json({ success: true, ...summary });
    }
    catch (err) {
        next(err);
    }
};
exports.syncAllTrackedBlogs = syncAllTrackedBlogs;
const getAdminBlogPosts = async (req, res, next) => {
    try {
        const blogs = await cms_service_1.cmsService.getBlogPosts(true);
        res.json({ success: true, blogs });
    }
    catch (err) {
        next(err);
    }
};
exports.getAdminBlogPosts = getAdminBlogPosts;
const updateAdminBlogPost = async (req, res, next) => {
    try {
        const id = req.params.id;
        const { isPublished, autoTrackNews } = req.body;
        const data = {};
        if (typeof isPublished === 'boolean')
            data.isPublished = isPublished;
        if (typeof autoTrackNews === 'boolean')
            data.autoTrackNews = autoTrackNews;
        const updated = await prisma_1.prisma.blogPost.update({ where: { id }, data });
        res.json({ success: true, blog: updated });
    }
    catch (err) {
        next(err);
    }
};
exports.updateAdminBlogPost = updateAdminBlogPost;
const deleteAdminBlogPost = async (req, res, next) => {
    try {
        const id = req.params.id;
        await prisma_1.prisma.blogPost.delete({ where: { id } });
        res.json({ success: true, message: 'Blog post deleted.' });
    }
    catch (err) {
        next(err);
    }
};
exports.deleteAdminBlogPost = deleteAdminBlogPost;
const getAiPublisherConfig = async (req, res, next) => {
    try {
        const status = await autoContent_service_1.autoContentService.getPublicAiStatus();
        res.json({ success: true, status });
    }
    catch (err) {
        next(err);
    }
};
exports.getAiPublisherConfig = getAiPublisherConfig;
const saveAiPublisherConfig = async (req, res, next) => {
    try {
        const { openaiApiKey, geminiApiKey, finnhubApiKey, alphaVantageApiKey } = req.body;
        const status = await autoContent_service_1.autoContentService.saveAiConfig({
            openaiApiKey,
            geminiApiKey,
            finnhubApiKey,
            alphaVantageApiKey,
        });
        res.json({ success: true, status });
    }
    catch (err) {
        next(err);
    }
};
exports.saveAiPublisherConfig = saveAiPublisherConfig;
