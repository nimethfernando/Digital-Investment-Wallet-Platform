"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getBlogPost = exports.getBlogPosts = exports.updateInquiryStatus = exports.getMyInquiries = exports.getInquiries = exports.submitInquiry = exports.updateSection = exports.getAllSections = exports.getPageSections = exports.updateSetting = exports.getSettings = void 0;
const zod_1 = require("zod");
const cms_service_1 = require("../services/cms.service");
const client_1 = require("@prisma/client");
const inquirySchema = zod_1.z.object({
    type: zod_1.z.nativeEnum(client_1.InquiryType),
    name: zod_1.z.string().min(2, 'Name is required'),
    email: zod_1.z.string().email('Valid email is required'),
    phone: zod_1.z.string().optional(),
    subject: zod_1.z.string().min(3, 'Subject is required'),
    message: zod_1.z.string().min(10, 'Message must be at least 10 characters'),
});
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
        const blog = await cms_service_1.cmsService.getBlogPostBySlug(slug);
        if (!blog)
            return res.status(404).json({ success: false, message: 'Blog post not found' });
        res.json({ success: true, blog });
    }
    catch (err) {
        next(err);
    }
};
exports.getBlogPost = getBlogPost;
