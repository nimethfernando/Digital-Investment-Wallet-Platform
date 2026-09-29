import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

const uploadDir = path.resolve(process.env.UPLOAD_DIR || './uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

['documents', 'branding', 'brochures', 'receipts'].forEach((sub) => {
  const p = path.join(uploadDir, sub);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req: Request, file: Express.Multer.File, cb) => {
    let folder = 'documents';
    if (file.fieldname === 'logo' || file.fieldname === 'favicon') folder = 'branding';
    else if (file.fieldname === 'brochure') folder = 'brochures';
    else if (file.fieldname === 'proof') folder = 'receipts';

    cb(null, path.join(uploadDir, folder));
  },
  filename: (req: Request, file: Express.Multer.File, cb) => {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
  },
});

export const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|svg|pdf/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpg, png, webp, svg) and PDF documents are permitted'));
  },
});

export const getUploadPath = (folder: string, filename: string): string => {
  return `/uploads/${folder}/${filename}`;
};
