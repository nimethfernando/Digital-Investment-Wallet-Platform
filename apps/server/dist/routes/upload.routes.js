"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const storage_service_1 = require("../services/storage.service");
const auth_1 = require("../middleware/auth");
const cms_service_1 = require("../services/cms.service");
const router = (0, express_1.Router)();
router.post('/branding', auth_1.authenticateToken, auth_1.requireAdmin, storage_service_1.upload.single('logo'), async (req, res, next) => {
    try {
        if (!req.file)
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        const assetType = req.body.type || 'logo_light';
        const url = (0, storage_service_1.getUploadPath)('branding', req.file.filename);
        const keyMap = {
            logo_light: 'logo_light_url',
            logo_dark: 'logo_dark_url',
            favicon: 'favicon_url',
        };
        const settingKey = keyMap[assetType] || 'logo_light_url';
        await cms_service_1.cmsService.updateSetting(settingKey, url, 'BRANDING');
        res.json({
            success: true,
            message: 'Branding asset uploaded and updated in platform settings',
            url,
            key: settingKey,
        });
    }
    catch (err) {
        next(err);
    }
});
router.post('/brochure', auth_1.authenticateToken, auth_1.requireAdmin, storage_service_1.upload.single('brochure'), async (req, res, next) => {
    try {
        if (!req.file)
            return res.status(400).json({ success: false, message: 'No PDF brochure uploaded' });
        const url = (0, storage_service_1.getUploadPath)('brochures', req.file.filename);
        await cms_service_1.cmsService.updateSetting('brochure_pdf_url', url, 'BRANDING');
        await cms_service_1.cmsService.updateSetting('brochure_enabled', 'true', 'BRANDING');
        res.json({
            success: true,
            message: 'Brochure PDF uploaded successfully and enabled',
            url,
        });
    }
    catch (err) {
        next(err);
    }
});
router.post('/document', auth_1.authenticateToken, storage_service_1.upload.single('proof'), async (req, res, next) => {
    try {
        if (!req.file)
            return res.status(400).json({ success: false, message: 'No document uploaded' });
        const folder = req.file.fieldname === 'proof' ? 'receipts' : 'documents';
        const url = (0, storage_service_1.getUploadPath)(folder, req.file.filename);
        res.json({
            success: true,
            message: 'File uploaded successfully',
            url,
        });
    }
    catch (err) {
        next(err);
    }
});
exports.default = router;
