import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { cmsService } from '../services/cms.service';
import { InquiryType } from '@prisma/client';

const inquirySchema = z.object({
  type: z.nativeEnum(InquiryType),
  name: z.string().min(2, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
  subject: z.string().min(3, 'Subject is required'),
  message: z.string().min(10, 'Message must be at least 10 characters'),
});

export const getSettings = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await cmsService.getPublicSettings();
    res.json({ success: true, settings });
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
    const page = req.params.page as string;
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
    const blogs = await cmsService.getBlogPosts();
    res.json({ success: true, blogs });
  } catch (err) {
    next(err);
  }
};

export const getBlogPost = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const slug = req.params.slug as string;
    const blog = await cmsService.getBlogPostBySlug(slug);
    if (!blog) return res.status(404).json({ success: false, message: 'Blog post not found' });
    res.json({ success: true, blog });
  } catch (err) {
    next(err);
  }
};
