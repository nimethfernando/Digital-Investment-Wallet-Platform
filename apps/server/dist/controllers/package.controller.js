"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.packageController = exports.PackageController = void 0;
const package_service_1 = require("../services/package.service");
class PackageController {
    /**
     * Get authenticated user's investment packages
     */
    async getUserPackages(req, res, next) {
        try {
            const userId = req.user.id;
            const packages = await package_service_1.packageService.getUserPackages(userId);
            res.json({ success: true, data: packages });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get package settings / tiers configuration
     */
    async getTiers(req, res, next) {
        try {
            const rules = await package_service_1.packageService.getPackageSettings();
            res.json({ success: true, data: rules });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Purchase an investment package
     */
    async purchase(req, res, next) {
        try {
            const userId = req.user.id;
            const { amount, depositMethod, proofUrl, txHashOrRef } = req.body;
            if (!amount || !depositMethod) {
                return res.status(400).json({ success: false, message: 'Amount and deposit method are required' });
            }
            const result = await package_service_1.packageService.purchasePackage(userId, {
                amount,
                depositMethod,
                proofUrl,
                txHashOrRef,
            });
            res.status(201).json(result);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.PackageController = PackageController;
exports.packageController = new PackageController();
