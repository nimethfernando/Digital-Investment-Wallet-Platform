"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPersistedUploadedAsset = exports.persistUploadedAsset = exports.persistUploadedBuffer = exports.ensureUploadedAssetTable = exports.getUploadPath = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const config_1 = require("../config");
const prisma_1 = require("../lib/prisma");
const isServerless = Boolean(process.env.VERCEL || process.env.VERCEL_ENV || process.env.NOW_REGION || process.env.AWS_LAMBDA_FUNCTION_NAME);
const uploadDir = isServerless
    ? path_1.default.join('/tmp', 'uploads')
    : path_1.default.resolve(config_1.config.uploadDir || process.env.UPLOAD_DIR || './uploads');
try {
    if (!fs_1.default.existsSync(uploadDir)) {
        fs_1.default.mkdirSync(uploadDir, { recursive: true });
    }
    ['documents', 'branding', 'brochures', 'receipts'].forEach((sub) => {
        const p = path_1.default.join(uploadDir, sub);
        if (!fs_1.default.existsSync(p))
            fs_1.default.mkdirSync(p, { recursive: true });
    });
}
catch (err) {
    console.warn('[Storage] Upload directory initialization warning:', err);
}
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        let folder = 'documents';
        if (file.fieldname === 'logo' || file.fieldname === 'favicon')
            folder = 'branding';
        else if (file.fieldname === 'brochure')
            folder = 'brochures';
        else if (file.fieldname === 'proof')
            folder = 'receipts';
        cb(null, path_1.default.join(uploadDir, folder));
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    },
});
exports.upload = (0, multer_1.default)({
    storage,
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = /jpeg|jpg|png|webp|svg|pdf/;
        const ext = allowed.test(path_1.default.extname(file.originalname).toLowerCase());
        const mime = allowed.test(file.mimetype);
        if (ext && mime) {
            return cb(null, true);
        }
        cb(new Error('Only images (jpg, png, webp, svg) and PDF documents are permitted'));
    },
});
const getUploadPath = (folder, filename) => {
    return `/uploads/${folder}/${filename}`;
};
exports.getUploadPath = getUploadPath;
let uploadedAssetTableReady = null;
const ensureUploadedAssetTable = async () => {
    if (!uploadedAssetTableReady) {
        uploadedAssetTableReady = prisma_1.prisma
            .$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS \`diw_uploaded_assets\` (
          \`urlPath\` VARCHAR(255) NOT NULL PRIMARY KEY,
          \`mimeType\` VARCHAR(120) NOT NULL,
          \`originalName\` VARCHAR(255) NULL,
          \`contentBase64\` LONGTEXT NOT NULL,
          \`sizeBytes\` INT NOT NULL DEFAULT 0,
          \`createdAt\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
        ) DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`)
            .then(() => undefined)
            .catch((err) => {
            uploadedAssetTableReady = null;
            throw err;
        });
    }
    return uploadedAssetTableReady;
};
exports.ensureUploadedAssetTable = ensureUploadedAssetTable;
const persistUploadedBuffer = async (params) => {
    try {
        await (0, exports.ensureUploadedAssetTable)();
        const contentBase64 = params.buffer.toString('base64');
        await prisma_1.prisma.$executeRawUnsafe(`INSERT INTO \`diw_uploaded_assets\` (\`urlPath\`, \`mimeType\`, \`originalName\`, \`contentBase64\`, \`sizeBytes\`, \`createdAt\`)
       VALUES (?, ?, ?, ?, ?, NOW(3))
       ON DUPLICATE KEY UPDATE
         \`mimeType\` = VALUES(\`mimeType\`),
         \`originalName\` = VALUES(\`originalName\`),
         \`contentBase64\` = VALUES(\`contentBase64\`),
         \`sizeBytes\` = VALUES(\`sizeBytes\`)`, params.urlPath, params.mimeType || 'application/octet-stream', params.originalName || null, contentBase64, params.buffer.length);
    }
    catch (err) {
        console.warn('[Storage] Failed to persist buffer to database fallback:', err);
    }
};
exports.persistUploadedBuffer = persistUploadedBuffer;
/**
 * Persist uploaded file bytes into MySQL so files survive ephemeral container restarts (e.g. Render redeploys).
 */
const persistUploadedAsset = async (params) => {
    try {
        const buf = await fs_1.default.promises.readFile(params.filePath);
        await (0, exports.persistUploadedBuffer)({
            urlPath: params.urlPath,
            buffer: buf,
            mimeType: params.mimeType,
            originalName: params.originalName,
        });
    }
    catch (err) {
        console.warn('[Storage] Failed to persist upload to database fallback:', err);
    }
};
exports.persistUploadedAsset = persistUploadedAsset;
const getPersistedUploadedAsset = async (urlPath) => {
    try {
        await (0, exports.ensureUploadedAssetTable)();
        const rows = (await prisma_1.prisma.$queryRawUnsafe(`SELECT \`mimeType\`, \`originalName\`, \`contentBase64\`
       FROM \`diw_uploaded_assets\`
       WHERE \`urlPath\` = ?
       LIMIT 1`, urlPath));
        if (!Array.isArray(rows) || rows.length === 0 || !rows[0]?.contentBase64) {
            return null;
        }
        return {
            buffer: Buffer.from(rows[0].contentBase64, 'base64'),
            mimeType: rows[0].mimeType || 'application/octet-stream',
            originalName: rows[0].originalName || null,
        };
    }
    catch (err) {
        console.warn('[Storage] Failed to read upload from database fallback:', err);
        return null;
    }
};
exports.getPersistedUploadedAsset = getPersistedUploadedAsset;
