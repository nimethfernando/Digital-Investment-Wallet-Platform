"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const cms_controller_1 = require("../controllers/cms.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
// Public & User CMS/Ticket routes
router.get('/settings', cms_controller_1.getSettings);
router.get('/sections/:page', cms_controller_1.getPageSections);
router.get('/blogs', cms_controller_1.getBlogPosts);
router.get('/blogs/:slug', cms_controller_1.getBlogPost);
router.post('/inquiry', cms_controller_1.submitInquiry);
router.get('/my-tickets', auth_1.authenticateToken, cms_controller_1.getMyInquiries);
// Admin-only CMS routes
router.get('/admin/sections', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.getAllSections);
router.put('/admin/sections/:id', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.updateSection);
router.post('/admin/settings', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.updateSetting);
router.get('/admin/inquiries', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.getInquiries);
router.put('/admin/inquiries/:id', auth_1.authenticateToken, auth_1.requireAdmin, cms_controller_1.updateInquiryStatus);
exports.default = router;
