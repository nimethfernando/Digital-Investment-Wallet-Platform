"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmsService = exports.CmsService = void 0;
const client_1 = require("@prisma/client");
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
        notification_provider_1.notificationService.sendAdminAlert(`New Website Inquiry: ${data.subject} (${data.type})`, `From: ${data.name} (${data.email}, ${data.phone || 'No phone'})\n\nMessage:\n${data.message}`, { inquiryId: inquiry.id, type: data.type }).catch(() => { });
        return inquiry;
    }
    async subscribeNewsletter(email) {
        const cleanEmail = email.toLowerCase().trim();
        // Check if already subscribed in Inquiries
        const existing = await prisma_1.prisma.inquiry.findFirst({
            where: { email: cleanEmail, subject: 'NEWSLETTER: Avora Financial Intelligence Briefing' },
        });
        if (!existing) {
            await prisma_1.prisma.inquiry.create({
                data: {
                    type: client_1.InquiryType.GENERAL,
                    name: 'Investor Subscriber',
                    email: cleanEmail,
                    subject: 'NEWSLETTER: Avora Financial Intelligence Briefing',
                    message: 'Subscribed to weekly institutional yield reports, OTC liquidity desk announcements, and platform updates.',
                    status: 'RESOLVED',
                },
            });
        }
        // Send confirmation welcome email
        notification_provider_1.notificationService.sendEmail({
            to: cleanEmail,
            subject: 'Welcome to the Avora Financial Intelligence Briefing',
            html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background: #090d16; color: #f8fafc; padding: 36px; border-radius: 20px; border: 1px solid rgba(16, 185, 129, 0.35); box-shadow: 0 20px 40px rgba(0,0,0,0.6);">
          <div style="border-bottom: 1px solid #1e293b; padding-bottom: 18px; margin-bottom: 24px;">
            <h1 style="color: #10b981; margin: 0; font-size: 24px; font-weight: 900; letter-spacing: -0.5px;">AVORA BANK</h1>
            <p style="color: #94a3b8; font-size: 11px; margin: 4px 0 0 0; text-transform: uppercase; letter-spacing: 1px;">Institutional Intelligence &amp; Wealth</p>
          </div>
          
          <h2 style="color: #ffffff; font-size: 20px; font-weight: 800; margin-top: 0;">Subscription Confirmed</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">
            Welcome to the <strong>Avora Financial Intelligence Briefing</strong>. You are now connected to our weekly institutional publication.
          </p>

          <div style="background: #0e1726; border: 1px solid #1e293b; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <h3 style="color: #38bdf8; font-size: 13px; margin-top: 0; text-transform: uppercase; letter-spacing: 0.5px;">What You Will Receive Every Week:</h3>
            <ul style="color: #94a3b8; font-size: 13px; line-height: 1.8; padding-left: 20px; margin-bottom: 0;">
              <li>Monthly yield distribution metrics &amp; package performance reports</li>
              <li>Virtual Visa/Mastercard BaaS corridors &amp; spending limit upgrades</li>
              <li>Global OTC liquidity spreads across Dubai, Colombo, London &amp; SEPA rails</li>
              <li>Private client startup crowdfunding allocations &amp; secondary liquidity notes</li>
            </ul>
          </div>

          <p style="color: #64748b; font-size: 11px; line-height: 1.5; margin-top: 24px; border-top: 1px solid #1e293b; padding-top: 16px;">
            Avora Bank • Institutional Operations &amp; Global OTC Liquidity Rails.<br>
            Hotline: +995 555433091 | Telegram: @avorallc
          </p>
        </div>
      `,
        }).catch(() => { });
        // Alert admin
        notification_provider_1.notificationService.sendAdminAlert('New Newsletter Subscriber', `Investor email: ${cleanEmail} subscribed to the Avora Financial Intelligence Briefing.`).catch(() => { });
        return { success: true, message: 'Thank you for subscribing! A welcome confirmation has been sent to your email.' };
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
