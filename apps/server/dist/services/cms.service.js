"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmsService = exports.CmsService = void 0;
const prisma_1 = require("../lib/prisma");
const notification_provider_1 = require("../adapters/notification/notification.provider");
class CmsService {
    async getPublicSettings() {
        const settings = await prisma_1.prisma.cmsSetting.findMany();
        const map = {};
        for (const s of settings) {
            map[s.key] = s.value;
        }
        return map;
    }
    async updateSetting(key, value, group = 'GENERAL') {
        return prisma_1.prisma.cmsSetting.upsert({
            where: { key },
            update: { value },
            create: { key, value, group },
        });
    }
    async getPageSections(page) {
        return prisma_1.prisma.cmsSection.findMany({
            where: { page: page.toUpperCase(), isActive: true },
            orderBy: { sortOrder: 'asc' },
        });
    }
    async getAllSections() {
        return prisma_1.prisma.cmsSection.findMany({
            orderBy: [{ page: 'asc' }, { sortOrder: 'asc' }],
        });
    }
    async updateSection(id, data) {
        return prisma_1.prisma.cmsSection.update({
            where: { id },
            data,
        });
    }
    async getBlogPosts() {
        return prisma_1.prisma.blogPost.findMany({
            where: { isPublished: true },
            orderBy: { publishedAt: 'desc' },
        });
    }
    async getBlogPostBySlug(slug) {
        return prisma_1.prisma.blogPost.findUnique({
            where: { slug },
        });
    }
    async submitInquiry(data) {
        const inquiry = await prisma_1.prisma.inquiry.create({
            data: {
                type: data.type,
                name: data.name,
                email: data.email,
                phone: data.phone,
                subject: data.subject,
                message: data.message,
                userId: data.userId,
            },
        });
        await notification_provider_1.notificationService.sendAdminAlert(`New Website Inquiry: ${data.subject} (${data.type})`, `From: ${data.name} (${data.email}, ${data.phone || 'No phone'})\n\nMessage:\n${data.message}`, { inquiryId: inquiry.id, type: data.type });
        return inquiry;
    }
    async getInquiries(page = 1, limit = 20) {
        const skip = (page - 1) * limit;
        const [inquiries, total] = await Promise.all([
            prisma_1.prisma.inquiry.findMany({
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.inquiry.count(),
        ]);
        return { inquiries, total, page, totalPages: Math.ceil(total / limit) };
    }
    async updateInquiryStatus(id, status, adminNotes) {
        return prisma_1.prisma.inquiry.update({
            where: { id },
            data: { status, adminNotes },
        });
    }
    async getUserInquiries(userId) {
        return prisma_1.prisma.inquiry.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
    }
}
exports.CmsService = CmsService;
exports.cmsService = new CmsService();
