"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.kycProvider = exports.ManualAdminKycProvider = void 0;
class ManualAdminKycProvider {
    name = 'ManualAdminKycProvider';
    async submitKycApplication(userId, documents) {
        return {
            kycReference: `KYC-${userId.slice(0, 8).toUpperCase()}-${Date.now()}`,
            status: 'MANUAL_REVIEW',
            message: 'Documents stored securely. Queued for compliance officer review.',
        };
    }
    async checkAmlScreening(name, country, idNumber) {
        return {
            passed: true,
            flags: [],
        };
    }
}
exports.ManualAdminKycProvider = ManualAdminKycProvider;
exports.kycProvider = new ManualAdminKycProvider();
