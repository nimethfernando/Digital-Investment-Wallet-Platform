import { Router } from 'express';
import {
  getSettings,
  updateSetting,
  getPageSections,
  getAllSections,
  updateSection,
  submitInquiry,
  getInquiries,
  updateInquiryStatus,
  getBlogPosts,
  getBlogPost,
} from '../controllers/cms.controller';
import { authenticateToken, requireAdmin } from '../middleware/auth';

const router = Router();

// Public CMS routes
router.get('/settings', getSettings);
router.get('/sections/:page', getPageSections);
router.get('/blogs', getBlogPosts);
router.get('/blogs/:slug', getBlogPost);
router.post('/inquiry', submitInquiry);

// Admin-only CMS routes
router.get('/admin/sections', authenticateToken, requireAdmin, getAllSections);
router.put('/admin/sections/:id', authenticateToken, requireAdmin, updateSection);
router.post('/admin/settings', authenticateToken, requireAdmin, updateSetting);
router.get('/admin/inquiries', authenticateToken, requireAdmin, getInquiries);
router.put('/admin/inquiries/:id', authenticateToken, requireAdmin, updateInquiryStatus);

export default router;
