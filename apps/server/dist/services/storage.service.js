"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUploadPath = exports.upload = void 0;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uploadDir = path_1.default.resolve(process.env.UPLOAD_DIR || './uploads');
if (!fs_1.default.existsSync(uploadDir)) {
    fs_1.default.mkdirSync(uploadDir, { recursive: true });
}
['documents', 'branding', 'brochures', 'receipts'].forEach((sub) => {
    const p = path_1.default.join(uploadDir, sub);
    if (!fs_1.default.existsSync(p))
        fs_1.default.mkdirSync(p, { recursive: true });
});
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
