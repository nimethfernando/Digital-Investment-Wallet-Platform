import { PrismaClient, InquiryType } from '@prisma/client';
import { notificationService } from '../adapters/notification/notification.provider';

const prisma = new PrismaClient();

export class CmsService {
  async getPublicSettings() {
    const settings = await prisma.cmsSetting.findMany();
    const map: Record<string, string> = {};
    for (const s of settings) {
      map[s.key] = s.value;
    }
    return map;
  }

  async updateSetting(key: string, value: string, group = 'GENERAL') {
    return prisma.cmsSetting.upsert({
      where: { key },
      update: { value },
      create: { key, value, group },
    });
  }

  async getPageSections(page: string) {
    return prisma.cmsSection.findMany({
      where: { page: page.toUpperCase(), isActive: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async getAllSections() {
    return prisma.cmsSection.findMany({
      orderBy: [{ page: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async updateSection(id: string, data: { title?: string; subtitle?: string; content?: string; metadata?: string; isActive?: boolean }) {
    return prisma.cmsSection.update({
      where: { id },
      data,
    });
  }

  async getBlogPosts() {
    return prisma.blogPost.findMany({
      where: { isPublished: true },
      orderBy: { publishedAt: 'desc' },
    });
  }

  async getBlogPostBySlug(slug: string) {
    return prisma.blogPost.findUnique({
      where: { slug },
    });
  }

  async submitInquiry(data: {
    type: InquiryType;
    name: string;
    email: string;
    phone?: string;
    subject: string;
    message: string;
    userId?: string;
  }) {
    const inquiry = await prisma.inquiry.create({
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

    await notificationService.sendAdminAlert(
      `New Website Inquiry: ${data.subject} (${data.type})`,
      `From: ${data.name} (${data.email}, ${data.phone || 'No phone'})\n\nMessage:\n${data.message}`,
      { inquiryId: inquiry.id, type: data.type }
    );

    return inquiry;
  }

  async getInquiries(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [inquiries, total] = await Promise.all([
      prisma.inquiry.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.inquiry.count(),
    ]);

    return { inquiries, total, page, totalPages: Math.ceil(total / limit) };
  }

  async updateInquiryStatus(id: string, status: string, adminNotes?: string) {
    return prisma.inquiry.update({
      where: { id },
      data: { status, adminNotes },
    });
  }
}

export const cmsService = new CmsService();
