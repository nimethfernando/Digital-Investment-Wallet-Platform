"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cms_controller_1 = require("../controllers/cms.controller");
const auth_1 = require("../middleware/auth");
const featureControl_service_1 = require("../services/featureControl.service");
const router = (0, express_1.Router)();
// Minimal public & authenticated CMS/Ticket routes
router.get('/settings', auth_1.optionalAuthenticateToken, cms_controller_1.getSettings);
router.get('/feature-flags', auth_1.authenticateToken, async (req, res) => {
    try {
        const data = await featureControl_service_1.featureControlService.getAllFeatures();
        res.json({ success: true, data });
    }
    catch (err) {
        res.status(500).json({ success: false, message: err.message || 'Failed to load feature flags' });
    }
});
router.get('/variables', auth_1.authenticateToken, cms_controller_1.getPlatformVariables);
router.get('/sections/:page', auth_1.optionalAuthenticateToken, cms_controller_1.getPageSections);
router.get('/blogs', auth_1.authenticateToken, cms_controller_1.getBlogPosts);
router.get('/blogs/cron-sync', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.syncAllTrackedBlogs);
router.get('/blogs/:slug', auth_1.authenticateToken, cms_controller_1.getBlogPost);
router.get('/media/banner/:slug', auth_1.authenticateToken, cms_controller_1.getBlogBannerMedia);
router.get('/media/meme/:slug', auth_1.authenticateToken, cms_controller_1.getBlogMemeMedia);
router.post('/inquiry', auth_1.optionalAuthenticateToken, cms_controller_1.submitInquiry);
router.post('/newsletter', cms_controller_1.subscribeNewsletter);
router.get('/my-tickets', auth_1.authenticateToken, cms_controller_1.getMyInquiries);
// Admin-only CMS & Auto-Publisher routes
router.get('/admin/sections', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.getAllSections);
router.put('/admin/sections/:id', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.updateSection);
router.post('/admin/settings', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.updateSetting);
router.get('/admin/inquiries', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.getInquiries);
router.put('/admin/inquiries/:id', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.updateInquiryStatus);
router.get('/admin/blogs', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.getAdminBlogPosts);
router.post('/admin/blogs', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.createAdminBlogPost);
router.post('/admin/blogs/seed-defaults', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.seedDefaultBlogPostsAdmin);
router.post('/admin/blogs/sync-tokens', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.syncBlogTokensAdmin);
router.post('/admin/blogs/auto-publish', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.autoPublishBlog);
router.post('/admin/blogs/auto-publish-fresh', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.triggerAutonomousFreshPublish);
router.post('/admin/blogs/:id/sync-news', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.syncBlogNewsAdmin);
router.put('/admin/blogs/:id', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.updateAdminBlogPost);
router.patch('/admin/blogs/:id', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.updateAdminBlogPost);
router.delete('/admin/blogs/:id', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.deleteAdminBlogPost);
router.get('/admin/ai-config', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.getAiPublisherConfig);
router.post('/admin/ai-config', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.saveAiPublisherConfig);
exports.default = router;
