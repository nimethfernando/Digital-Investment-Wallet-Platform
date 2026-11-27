import { Router } from 'express';
import {
  getSettings,
  getPlatformVariables,
  updateSetting,
  getPageSections,
  getAllSections,
  updateSection,
  submitInquiry,
  subscribeNewsletter,
  getMyInquiries,
  getInquiries,
  updateInquiryStatus,
  getBlogPosts,
  getBlogPost,
  getBlogBannerMedia,
  getBlogMemeMedia,
  autoPublishBlog,
  triggerAutonomousFreshPublish,
  syncBlogNewsAdmin,
  syncAllTrackedBlogs,
  getAdminBlogPosts,
  createAdminBlogPost,
  updateAdminBlogPost,
  deleteAdminBlogPost,
  seedDefaultBlogPostsAdmin,
  syncBlogTokensAdmin,
  getAiPublisherConfig,
  saveAiPublisherConfig,
} from '../controllers/cms.controller';
import { authenticateToken, optionalAuthenticateToken, requireAdmin } from '../middleware/auth';
import { featureControlService } from '../services/featureControl.service';

const router = Router();

// Minimal public & authenticated CMS/Ticket routes
router.get('/settings', optionalAuthenticateToken, getSettings);
router.get('/feature-flags', authenticateToken, async (req, res) => {
  try {
    const data = await featureControlService.getAllFeatures();
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Failed to load feature flags' });
  }
});
router.get('/variables', authenticateToken, getPlatformVariables);
router.get('/sections/:page', optionalAuthenticateToken, getPageSections);
router.get('/blogs', authenticateToken, getBlogPosts);
router.get('/blogs/cron-sync', authenticateToken, requireAdmin, syncAllTrackedBlogs);
router.get('/blogs/:slug', authenticateToken, getBlogPost);
router.get('/media/banner/:slug', authenticateToken, getBlogBannerMedia);
router.get('/media/meme/:slug', authenticateToken, getBlogMemeMedia);
router.post('/inquiry', optionalAuthenticateToken, submitInquiry);
router.post('/newsletter', subscribeNewsletter);
router.get('/my-tickets', authenticateToken, getMyInquiries);

// Admin-only CMS & Auto-Publisher routes
router.get('/admin/sections', authenticateToken, requireAdmin, getAllSections);
router.put('/admin/sections/:id', authenticateToken, requireAdmin, updateSection);
router.post('/admin/settings', authenticateToken, requireAdmin, updateSetting);
router.get('/admin/inquiries', authenticateToken, requireAdmin, getInquiries);
router.put('/admin/inquiries/:id', authenticateToken, requireAdmin, updateInquiryStatus);
router.get('/admin/blogs', authenticateToken, requireAdmin, getAdminBlogPosts);
router.post('/admin/blogs', authenticateToken, requireAdmin, createAdminBlogPost);
router.post('/admin/blogs/seed-defaults', authenticateToken, requireAdmin, seedDefaultBlogPostsAdmin);
router.post('/admin/blogs/sync-tokens', authenticateToken, requireAdmin, syncBlogTokensAdmin);
router.post('/admin/blogs/auto-publish', authenticateToken, requireAdmin, autoPublishBlog);
router.post('/admin/blogs/auto-publish-fresh', authenticateToken, requireAdmin, triggerAutonomousFreshPublish);
router.post('/admin/blogs/:id/sync-news', authenticateToken, requireAdmin, syncBlogNewsAdmin);
router.put('/admin/blogs/:id', authenticateToken, requireAdmin, updateAdminBlogPost);
router.patch('/admin/blogs/:id', authenticateToken, requireAdmin, updateAdminBlogPost);
router.delete('/admin/blogs/:id', authenticateToken, requireAdmin, deleteAdminBlogPost);
router.get('/admin/ai-config', authenticateToken, requireAdmin, getAiPublisherConfig);
router.post('/admin/ai-config', authenticateToken, requireAdmin, saveAiPublisherConfig);

export default router;
