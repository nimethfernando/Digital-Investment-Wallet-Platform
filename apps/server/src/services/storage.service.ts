import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';
import { config } from '../config';
import { prisma } from '../lib/prisma';

const isServerless = Boolean(
  process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME
);
const uploadDir = isServerless
  ? path.join('/tmp', 'uploads')
  : path.resolve(config.uploadDir || process.env.UPLOAD_DIR || './uploads');

try {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  ['documents', 'branding', 'brochures', 'receipts'].forEach((sub) => {
    const p = path.join(uploadDir, sub);
    if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
  });
} catch (err) {
  console.warn('[Storage] Upload directory initialization warning:', err);
}

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
    const allowedExt = /\.(jpeg|jpg|png|webp|svg|gif|avif|ico|bmp|pdf)$/i;
    const allowedMime = /(jpeg|jpg|png|webp|svg|gif|avif|icon|bmp|pdf)/i;
    const extOk = allowedExt.test(path.extname(file.originalname || '').toLowerCase());
    const mimeOk = allowedMime.test(file.mimetype || '') || file.mimetype === 'application/octet-stream';
    if (extOk && mimeOk) {
      return cb(null, true);
    }
    cb(new Error('Only images (jpg, png, webp, svg, gif, avif, ico) and PDF documents are permitted'));
  },
});

export const getUploadPath = (folder: string, filename: string): string => {
  return `/uploads/${folder}/${filename}`;
};

let uploadedAssetTableReady: Promise<void> | null = null;

export const ensureUploadedAssetTable = async (): Promise<void> => {
  if (!uploadedAssetTableReady) {
    uploadedAssetTableReady = prisma
      .$executeRawUnsafe(
        `CREATE TABLE IF NOT EXISTS \`diw_uploaded_assets\` (
          \`urlPath\` VARCHAR(255) NOT NULL PRIMARY KEY,
          \`mimeType\` VARCHAR(120) NOT NULL,
          \`originalName\` VARCHAR(255) NULL,
          \`contentBase64\` LONGTEXT NOT NULL,
          \`sizeBytes\` INT NOT NULL DEFAULT 0,
          \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
      )
      .then(() => undefined)
      .catch((err) => {
        uploadedAssetTableReady = null;
        throw err;
      });
  }
  return uploadedAssetTableReady;
};

export const persistUploadedBuffer = async (params: {
  urlPath: string;
  buffer: Buffer;
  mimeType: string;
  originalName?: string;
}): Promise<void> => {
  try {
    await ensureUploadedAssetTable();
    const contentBase64 = params.buffer.toString('base64');
    await prisma.$executeRawUnsafe(
      `INSERT INTO \`diw_uploaded_assets\` (\`urlPath\`, \`mimeType\`, \`originalName\`, \`contentBase64\`, \`sizeBytes\`, \`createdAt\`)
       VALUES (?, ?, ?, ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE
         \`mimeType\` = VALUES(\`mimeType\`),
         \`originalName\` = VALUES(\`originalName\`),
         \`contentBase64\` = VALUES(\`contentBase64\`),
         \`sizeBytes\` = VALUES(\`sizeBytes\`)`,
      params.urlPath,
      params.mimeType || 'application/octet-stream',
      params.originalName || null,
      contentBase64,
      params.buffer.length
    );
  } catch (err) {
    console.warn('[Storage] Failed to persist buffer to database fallback:', err);
  }
};

/**
 * Persist uploaded file bytes into MySQL so files survive ephemeral container restarts (e.g. Render redeploys).
 */
export const persistUploadedAsset = async (params: {
  urlPath: string;
  filePath: string;
  mimeType: string;
  originalName?: string;
  sizeBytes?: number;
}): Promise<void> => {
  try {
    const buf = await fs.promises.readFile(params.filePath);
    await persistUploadedBuffer({
      urlPath: params.urlPath,
      buffer: buf,
      mimeType: params.mimeType,
      originalName: params.originalName,
    });
  } catch (err) {
    console.warn('[Storage] Failed to persist upload to database fallback:', err);
  }
};

export const getPersistedUploadedAsset = async (
  urlPath: string
): Promise<{ buffer: Buffer; mimeType: string; originalName: string | null } | null> => {
  try {
    await ensureUploadedAssetTable();
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT \`mimeType\`, \`originalName\`, \`contentBase64\`
       FROM \`diw_uploaded_assets\`
       WHERE \`urlPath\` = ?
       LIMIT 1`,
      urlPath
    )) as Array<{ mimeType: string; originalName: string | null; contentBase64: string }>;

    if (!Array.isArray(rows) || rows.length === 0 || !rows[0]?.contentBase64) {
      return null;
    }

    return {
      buffer: Buffer.from(rows[0].contentBase64, 'base64'),
      mimeType: rows[0].mimeType || 'application/octet-stream',
      originalName: rows[0].originalName || null,
    };
  } catch (err) {
    console.warn('[Storage] Failed to read upload from database fallback:', err);
    return null;
  }
};
