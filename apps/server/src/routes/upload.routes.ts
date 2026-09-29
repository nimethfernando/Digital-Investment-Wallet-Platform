import { Router, Request, Response, NextFunction } from 'express';
import { upload, getUploadPath } from '../services/storage.service';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { cmsService } from '../services/cms.service';

const router = Router();

router.post(
  '/branding',
  authenticateToken,
  requireAdmin,
  upload.single('logo'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No file uploaded' });
      const assetType = req.body.type || 'logo_light';
      const url = getUploadPath('branding', req.file.filename);
      
      const keyMap: Record<string, string> = {
        logo_light: 'logo_light_url',
        logo_dark: 'logo_dark_url',
        favicon: 'favicon_url',
      };

      const settingKey = keyMap[assetType] || 'logo_light_url';
      await cmsService.updateSetting(settingKey, url, 'BRANDING');

      res.json({
        success: true,
        message: 'Branding asset uploaded and updated in platform settings',
        url,
        key: settingKey,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/brochure',
  authenticateToken,
  requireAdmin,
  upload.single('brochure'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No PDF brochure uploaded' });
      const url = getUploadPath('brochures', req.file.filename);
      await cmsService.updateSetting('brochure_pdf_url', url, 'BRANDING');
      await cmsService.updateSetting('brochure_enabled', 'true', 'BRANDING');

      res.json({
        success: true,
        message: 'Brochure PDF uploaded successfully and enabled',
        url,
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post(
  '/document',
  authenticateToken,
  upload.single('proof'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) return res.status(400).json({ success: false, message: 'No document uploaded' });
      const folder = req.file.fieldname === 'proof' ? 'receipts' : 'documents';
      const url = getUploadPath(folder, req.file.filename);
      res.json({
        success: true,
        message: 'File uploaded successfully',
        url,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
