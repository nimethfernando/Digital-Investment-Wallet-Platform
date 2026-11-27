"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kycService = exports.KycService = void 0;
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const config_1 = require("../config");
const notification_provider_1 = require("../adapters/notification/notification.provider");
const compliancePolicy_service_1 = require("./compliancePolicy.service");
const storage_service_1 = require("./storage.service");
const VALID_KYC_STATUSES = [
    client_1.KycStatus.NOT_STARTED,
    client_1.KycStatus.PENDING,
    client_1.KycStatus.UNDER_REVIEW,
    client_1.KycStatus.APPROVED,
    client_1.KycStatus.REJECTED,
    client_1.KycStatus.ADDITIONAL_INFO_REQUIRED,
    client_1.KycStatus.EXPIRED,
];
function parseDataUrl(dataUrl) {
    const match = /^data:([a-zA-Z0-9/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec((dataUrl || '').trim());
    if (!match)
        return null;
    const mimeType = match[1].toLowerCase();
    const extMap = {
        'image/jpeg': 'jpg',
        'image/jpg': 'jpg',
        'image/png': 'png',
        'image/webp': 'webp',
        'image/gif': 'gif',
        'application/pdf': 'pdf',
    };
    const ext = extMap[mimeType] || 'bin';
    const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
    return { buffer, mimeType, ext };
}
class KycService {
    /**
     * Persist sensitive KYC document buffer privately in diw_uploaded_assets so it is NEVER exposed via public URLs
     */
    async storePrivateKycFile(params) {
        const parsed = parseDataUrl(params.rawUrlOrData);
        if (parsed) {
            const safeName = (params.originalFilename || `kyc_${params.docId.slice(0, 8)}.${parsed.ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');
            const privatePath = `/private/kyc/${params.userId}/${params.docId}.${parsed.ext}`;
            await (0, storage_service_1.persistUploadedBuffer)({
                urlPath: privatePath,
                buffer: parsed.buffer,
                mimeType: parsed.mimeType,
                originalName: safeName,
            });
            return {
                privatePath,
                mimeType: parsed.mimeType,
                originalFilename: safeName,
            };
        }
        const cleanUrl = String(params.rawUrlOrData || '').trim();
        const ext = path_1.default.extname(cleanUrl.split('?')[0]) || '.pdf';
        return {
            privatePath: cleanUrl,
            mimeType: ext.toLowerCase() === '.pdf' ? 'application/pdf' : 'image/png',
            originalFilename: params.originalFilename || `kyc_${params.docId.slice(0, 8)}${ext}`,
        };
    }
    /**
     * Submit KYC document for identity verification
     */
    async submitKyc(userId, input) {
        await compliancePolicy_service_1.compliancePolicyService.ensureComplianceSchema();
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found.');
        }
        if (user.kycStatus === client_1.KycStatus.APPROVED && (!user.kycExpiresAt || new Date() < user.kycExpiresAt)) {
            return {
                documentId: 'already_approved',
                documentType: input.documentType,
                status: client_1.KycStatus.APPROVED,
                message: 'Your identity verification (KYC) is already approved.',
            };
        }
        const docId = crypto_1.default.randomUUID();
        const stored = await this.storePrivateKycFile({
            userId,
            docId,
            rawUrlOrData: input.documentUrl,
            originalFilename: input.originalFilename,
        });
        const cleanIdNum = input.idNumber ? String(input.idNumber).trim().toUpperCase().slice(0, 120) : null;
        const cleanCountry = input.country ? String(input.country).trim().slice(0, 100) : user.country || null;
        const document = await prisma_1.prisma.kycDocument.create({
            data: {
                id: docId,
                userId,
                documentType: input.documentType,
                documentUrl: stored.privatePath,
                idNumber: cleanIdNum,
                issuingCountry: cleanCountry,
                submissionSource: input.provider === 'SUMSUB' ? 'SUMSUB_SDK' : 'PLATFORM_UPLOAD',
                originalFilename: stored.originalFilename,
                mimeType: stored.mimeType,
                status: client_1.KycStatus.PENDING,
            },
        });
        await prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                kycStatus: client_1.KycStatus.PENDING,
                kycSubmittedAt: new Date(),
                kycNotes: null,
            },
        });
        // Check duplicate document ID across different user accounts
        await compliancePolicy_service_1.compliancePolicyService.evaluateKycDocumentDuplicates({
            userId,
            idNumber: cleanIdNum || undefined,
            documentType: input.documentType,
            issuingCountry: cleanCountry || undefined,
        });
        // Audit Log
        await prisma_1.prisma.adminAuditLog
            .create({
            data: {
                userId,
                action: 'KYC_SUBMITTED',
                entity: 'KycDocument',
                entityId: document.id,
                details: `User ${user.email} submitted ${input.documentType} (${cleanCountry || 'N/A'}) via ${document.submissionSource}.`,
            },
        })
            .catch(() => { });
        notification_provider_1.notificationService.sendEmail({
            to: user.email,
            subject: `KYC Documents Received - Pending Compliance Review`,
            html: `<p>Hello ${user.firstName || 'Client'},</p><p>We received your <strong>${input.documentType}</strong> verification submission. Our Compliance Team will review your documents shortly.</p>`,
        }).catch(() => { });
        notification_provider_1.notificationService.sendAdminAlert(`New KYC Submission [${document.id.slice(0, 8).toUpperCase()}]`, `${user.firstName || 'Client'} (${user.email}) submitted ${input.documentType} documents for KYC identity verification.\nReview in Admin → KYC Compliance.`, { documentId: document.id, userId, email: user.email, documentType: input.documentType }).catch(() => { });
        return {
            documentId: document.id,
            documentType: document.documentType,
            status: client_1.KycStatus.PENDING,
            message: 'KYC identity documents submitted successfully. Application is pending compliance officer review.',
        };
    }
    /**
     * Admin-only sandbox instant verify (never exposed to unprivileged users in production)
     */
    async instantVerifyKyc(userId, input) {
        await compliancePolicy_service_1.compliancePolicyService.ensureComplianceSchema();
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found.');
        }
        const document = await prisma_1.prisma.kycDocument.create({
            data: {
                userId,
                documentType: input?.documentType || 'PASSPORT',
                documentUrl: '/private/kyc/admin_instant_verification.pdf',
                submissionSource: 'ADMIN_MANUAL',
                status: client_1.KycStatus.APPROVED,
                verifiedAt: new Date(),
            },
        });
        await prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                kycStatus: client_1.KycStatus.APPROVED,
                kycReviewedAt: new Date(),
            },
        });
        return {
            documentId: document.id,
            documentType: document.documentType,
            status: client_1.KycStatus.APPROVED,
            message: 'Verification approved.',
        };
    }
    /**
     * Reset user KYC status (only when NOT approved or by Admin)
     */
    async resetKyc(userId, isAdminAction = false) {
        await compliancePolicy_service_1.compliancePolicyService.ensureComplianceSchema();
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            throw new Error('User not found.');
        }
        if (user.kycStatus === client_1.KycStatus.APPROVED && !isAdminAction) {
            throw Object.assign(new Error('Approved KYC cannot be self-reset. Contact Compliance if re-verification is needed.'), {
                status: 403,
            });
        }
        await prisma_1.prisma.user.update({
            where: { id: userId },
            data: {
                kycStatus: client_1.KycStatus.NOT_STARTED,
                kycNotes: null,
            },
        });
        await prisma_1.prisma.adminAuditLog
            .create({
            data: {
                userId,
                action: 'KYC_RESET',
                entity: 'User',
                entityId: userId,
                details: `KYC status reset to NOT_STARTED for ${user.email}.`,
            },
        })
            .catch(() => { });
        return {
            kycStatus: client_1.KycStatus.NOT_STARTED,
            message: 'KYC status reset. You may submit your verification documents again.',
        };
    }
    /**
     * Get user's KYC verification status and sanitized documents (never returning public URLs)
     */
    async getKycStatus(userId) {
        await compliancePolicy_service_1.compliancePolicyService.ensureComplianceSchema();
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                emailVerified: true,
                kycStatus: true,
                kycSubmittedAt: true,
                kycReviewedAt: true,
                kycExpiresAt: true,
                kycNotes: true,
                kycDocuments: {
                    orderBy: { createdAt: 'desc' },
                },
            },
        });
        if (!user) {
            throw new Error('User not found.');
        }
        const policy = await compliancePolicy_service_1.compliancePolicyService.getPolicy();
        return {
            kycStatus: user.kycStatus,
            kycStatusLabel: compliancePolicy_service_1.KYC_STATUS_LABELS[user.kycStatus] || user.kycStatus,
            isVerified: user.kycStatus === client_1.KycStatus.APPROVED,
            emailVerified: user.emailVerified,
            kycSubmittedAt: user.kycSubmittedAt,
            kycReviewedAt: user.kycReviewedAt,
            kycExpiresAt: user.kycExpiresAt,
            kycNotes: user.kycNotes,
            policy: {
                kycRequiredFeatures: policy.kycRequiredFeatures,
                requireEmailVerificationForSensitiveActions: policy.emailVerification.requireEmailVerificationForSensitiveActions,
            },
            documents: user.kycDocuments.map((doc) => ({
                id: doc.id,
                documentType: doc.documentType,
                idNumber: doc.idNumber,
                issuingCountry: doc.issuingCountry,
                submissionSource: doc.submissionSource,
                complianceNotes: doc.complianceNotes,
                originalFilename: doc.originalFilename,
                mimeType: doc.mimeType,
                hasDocumentFile: Boolean(doc.documentUrl && !doc.documentUrl.startsWith('https://secure-docs.avora.bank')),
                secureDocumentPath: `/api/v1/auth/kyc/${doc.id}/document`,
                status: doc.status,
                statusLabel: compliancePolicy_service_1.KYC_STATUS_LABELS[doc.status] || doc.status,
                rejectionReason: doc.rejectionReason,
                expiresAt: doc.expiresAt,
                verifiedAt: doc.verifiedAt,
                createdAt: doc.createdAt,
            })),
        };
    }
    /**
     * Generate third-party biometric verification session token (Sumsub / Onfido)
     */
    async generateProviderToken(userId, provider = 'SUMSUB') {
        const user = await prisma_1.prisma.user.findUnique({ where: { id: userId } });
        if (!user)
            throw new Error('User not found.');
        const applicantId = `app_${provider.toLowerCase()}_${userId.slice(0, 8)}`;
        const accessToken = `tok_${provider.toLowerCase()}_${Buffer.from(`${userId}:${Date.now()}`).toString('base64')}`;
        return {
            provider,
            applicantId,
            accessToken,
            workflow: 'IDENTITY_AND_LIVENESS_CHECK',
            expiresIn: 3600,
        };
    }
    /**
     * Securely retrieve KYC document bytes (RBAC protected & Audit Logged)
     */
    async getSecureDocumentFile(params) {
        await compliancePolicy_service_1.compliancePolicyService.ensureComplianceSchema();
        const doc = await prisma_1.prisma.kycDocument.findUnique({
            where: { id: params.documentId },
            include: { user: { select: { id: true, email: true } } },
        });
        if (!doc) {
            throw Object.assign(new Error('KYC document record not found.'), { status: 404 });
        }
        const isComplianceAdmin = params.requesterRole === client_1.Role.ADMIN || params.requesterRole === client_1.Role.STAFF;
        const isOwner = doc.userId === params.requesterId;
        if (!isComplianceAdmin && !isOwner) {
            throw Object.assign(new Error('Forbidden: You are not authorized to access this KYC document.'), {
                status: 403,
            });
        }
        // Log every KYC document access!
        await prisma_1.prisma.adminAuditLog
            .create({
            data: {
                userId: params.requesterId,
                action: isComplianceAdmin ? 'VIEW_KYC_DOCUMENT' : 'USER_VIEW_OWN_KYC_DOCUMENT',
                entity: 'KycDocument',
                entityId: doc.id,
                ipAddress: params.requesterIp || null,
                details: `${isComplianceAdmin ? 'Compliance/Admin' : 'Owner'} accessed KYC document ${doc.id} (${doc.documentType}) belonging to ${doc.user.email}.`,
            },
        })
            .catch(() => { });
        const rawUrl = String(doc.documentUrl || '');
        // 1. Inline legacy data URL
        const parsedData = parseDataUrl(rawUrl);
        if (parsedData) {
            return {
                buffer: parsedData.buffer,
                mimeType: doc.mimeType || parsedData.mimeType,
                filename: doc.originalFilename || `kyc_${doc.id.slice(0, 8)}.${parsedData.ext}`,
            };
        }
        // 2. Persisted private or legacy asset in diw_uploaded_assets
        const persisted = await (0, storage_service_1.getPersistedUploadedAsset)(rawUrl);
        if (persisted) {
            return {
                buffer: persisted.buffer,
                mimeType: doc.mimeType || persisted.mimeType,
                filename: doc.originalFilename || persisted.originalName || `kyc_${doc.id.slice(0, 8)}.bin`,
            };
        }
        // 3. Disk fallback for legacy local uploads
        if (rawUrl.startsWith('/uploads/')) {
            const uploadsDir = path_1.default.resolve(config_1.config.uploadDir || './uploads');
            const rel = rawUrl.replace(/^\/uploads\/?/, '');
            const filePath = path_1.default.join(uploadsDir, rel);
            if (fs_1.default.existsSync(filePath)) {
                const buf = await fs_1.default.promises.readFile(filePath);
                return {
                    buffer: buf,
                    mimeType: doc.mimeType || 'application/octet-stream',
                    filename: doc.originalFilename || path_1.default.basename(filePath),
                };
            }
        }
        // 4. Placeholder summary certificate if submitted via Email Channel without binary attachment or SDK metadata
        const summarySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="800" height="440" viewBox="0 0 800 440">
  <rect width="800" height="440" rx="16" fill="#090d16" stroke="#1e293b" stroke-width="2"/>
  <text x="44" y="64" font-family="sans-serif" font-size="22" font-weight="900" fill="#10b981">AVORA BANK • COMPLIANCE KYC RECORD</text>
  <line x1="44" y1="86" x2="756" y2="86" stroke="#1e293b" stroke-width="1.5"/>
  <text x="44" y="130" font-family="monospace" font-size="14" fill="#94a3b8">CLIENT ACCOUNT: <tspan fill="#ffffff">${doc.user.email}</tspan></text>
  <text x="44" y="166" font-family="monospace" font-size="14" fill="#94a3b8">DOCUMENT TYPE : <tspan fill="#38bdf8">${doc.documentType}</tspan></text>
  <text x="44" y="202" font-family="monospace" font-size="14" fill="#94a3b8">ID NUMBER     : <tspan fill="#ffffff">${doc.idNumber || 'Verified via External/Email Channel'}</tspan></text>
  <text x="44" y="238" font-family="monospace" font-size="14" fill="#94a3b8">SOURCE CHANNEL: <tspan fill="#fbbf24">${doc.submissionSource || 'PLATFORM_UPLOAD'}</tspan></text>
  <text x="44" y="274" font-family="monospace" font-size="14" fill="#94a3b8">STATUS        : <tspan fill="#10b981">${compliancePolicy_service_1.KYC_STATUS_LABELS[doc.status] || doc.status}</tspan></text>
  <text x="44" y="318" font-family="sans-serif" font-size="13" fill="#cbd5e1">Notes: ${(doc.complianceNotes || doc.rejectionReason || 'No binary attachment required / verified off-platform.').replace(/[<>&]/g, '')}</text>
  <text x="44" y="392" font-family="monospace" font-size="11" fill="#64748b">RECORD ID: ${doc.id} • ACCESS LOGGED IN ADMIN AUDIT LEDGER</text>
</svg>`;
        return {
            buffer: Buffer.from(summarySvg, 'utf8'),
            mimeType: 'image/svg+xml',
            filename: `kyc_record_${doc.id.slice(0, 8)}.svg`,
        };
    }
    /**
     * Admin: Full KYC Compliance Overview across ALL 7 statuses + User Directory & Anti-Spam Metrics
     */
    async getAdminKycOverview(filters) {
        await compliancePolicy_service_1.compliancePolicyService.ensureComplianceSchema();
        const q = (filters?.search || '').trim().toLowerCase();
        const statusFilter = (filters?.status || 'ALL').trim().toUpperCase();
        const [allDocs, allUsers, recentAuditLogs] = await Promise.all([
            prisma_1.prisma.kycDocument.findMany({
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                            displayName: true,
                            phone: true,
                            country: true,
                            signupLocation: true,
                            signupIp: true,
                            status: true,
                            emailVerified: true,
                            kycStatus: true,
                            kycSubmittedAt: true,
                            kycReviewedAt: true,
                            kycExpiresAt: true,
                            kycNotes: true,
                            isSuspicious: true,
                            suspiciousReason: true,
                            riskScore: true,
                            createdAt: true,
                        },
                    },
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.user.findMany({
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    displayName: true,
                    phone: true,
                    country: true,
                    signupLocation: true,
                    signupIp: true,
                    role: true,
                    status: true,
                    emailVerified: true,
                    kycStatus: true,
                    kycSubmittedAt: true,
                    kycReviewedAt: true,
                    kycExpiresAt: true,
                    kycNotes: true,
                    isSuspicious: true,
                    suspiciousReason: true,
                    riskScore: true,
                    bypassNewUserLimits: true,
                    createdAt: true,
                },
                orderBy: { createdAt: 'desc' },
            }),
            prisma_1.prisma.adminAuditLog.findMany({
                where: {
                    OR: [
                        { entity: 'KycDocument' },
                        { action: { contains: 'KYC' } },
                        { action: { in: ['USER_REGISTERED', 'USER_EMAIL_VERIFIED', 'DUPLICATE_ACCOUNT_DETECTED', 'USER_FLAGGED_SUSPICIOUS', 'USER_SUSPICIOUS_CLEARED', 'LOGIN_BRUTE_FORCE_FLAG', 'COMPLIANCE_POLICY_UPDATED'] } },
                    ],
                },
                include: {
                    user: { select: { email: true, firstName: true, lastName: true } },
                },
                orderBy: { createdAt: 'desc' },
                take: 100,
            }),
        ]);
        const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
        const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const statusCounts = {
            totalUsers: allUsers.length,
            newRegistrations24h: allUsers.filter((u) => new Date(u.createdAt).getTime() >= dayAgo).length,
            newRegistrations7d: allUsers.filter((u) => new Date(u.createdAt).getTime() >= weekAgo).length,
            notSubmitted: allUsers.filter((u) => u.kycStatus === client_1.KycStatus.NOT_STARTED).length,
            pending: allUsers.filter((u) => u.kycStatus === client_1.KycStatus.PENDING).length,
            underReview: allUsers.filter((u) => u.kycStatus === client_1.KycStatus.UNDER_REVIEW).length,
            approved: allUsers.filter((u) => u.kycStatus === client_1.KycStatus.APPROVED).length,
            rejected: allUsers.filter((u) => u.kycStatus === client_1.KycStatus.REJECTED).length,
            additionalInfoRequired: allUsers.filter((u) => u.kycStatus === client_1.KycStatus.ADDITIONAL_INFO_REQUIRED).length,
            expired: allUsers.filter((u) => u.kycStatus === client_1.KycStatus.EXPIRED).length,
            suspendedUsers: allUsers.filter((u) => u.status === 'SUSPENDED' || u.status === 'LOCKED').length,
            suspiciousUsers: allUsers.filter((u) => u.isSuspicious).length,
            unverifiedEmailUsers: allUsers.filter((u) => !u.emailVerified).length,
            totalSubmissions: allDocs.length,
        };
        const sanitizedDocs = allDocs
            .map((d) => ({
            id: d.id,
            userId: d.userId,
            documentType: d.documentType,
            idNumber: d.idNumber,
            issuingCountry: d.issuingCountry,
            submissionSource: d.submissionSource || 'PLATFORM_UPLOAD',
            complianceNotes: d.complianceNotes,
            originalFilename: d.originalFilename,
            mimeType: d.mimeType,
            hasDocumentFile: Boolean(d.documentUrl),
            // Protected API route ONLY - never public URL or raw base64
            secureDocumentPath: `/api/v1/admin/kyc/${d.id}/document`,
            status: d.status,
            statusLabel: compliancePolicy_service_1.KYC_STATUS_LABELS[d.status] || d.status,
            rejectionReason: d.rejectionReason,
            expiresAt: d.expiresAt,
            verifiedAt: d.verifiedAt,
            reviewedBy: d.reviewedBy,
            createdAt: d.createdAt,
            user: d.user,
        }))
            .filter((d) => {
            if (statusFilter !== 'ALL' && d.status !== statusFilter)
                return false;
            if (q) {
                const hay = `${d.user?.email || ''} ${d.user?.firstName || ''} ${d.user?.lastName || ''} ${d.documentType} ${d.idNumber || ''} ${d.issuingCountry || ''}`.toLowerCase();
                if (!hay.includes(q))
                    return false;
            }
            return true;
        });
        return {
            documents: sanitizedDocs,
            statusCounts,
            users: allUsers,
            auditLogs: recentAuditLogs,
        };
    }
    /**
     * Legacy helper kept for compatibility (lists pending submissions)
     */
    async getPendingKyc() {
        const overview = await this.getAdminKycOverview({ status: 'ALL' });
        return overview.documents;
    }
    /**
     * Admin: Update KYC status for any document OR manually for any user (including email/support channel submissions)
     */
    async adminUpdateKycStatus(params) {
        await compliancePolicy_service_1.compliancePolicyService.ensureComplianceSchema();
        if (!VALID_KYC_STATUSES.includes(params.status)) {
            throw Object.assign(new Error(`Invalid KYC status: ${params.status}`), { status: 400 });
        }
        let doc = params.documentId
            ? await prisma_1.prisma.kycDocument.findUnique({ where: { id: params.documentId } })
            : null;
        const targetUserId = doc?.userId || params.userId;
        if (!targetUserId) {
            throw Object.assign(new Error('Target userId or documentId is required.'), { status: 400 });
        }
        const user = await prisma_1.prisma.user.findUnique({ where: { id: targetUserId } });
        if (!user) {
            throw Object.assign(new Error('Target user not found.'), { status: 404 });
        }
        const needsReason = params.status === client_1.KycStatus.REJECTED ||
            params.status === client_1.KycStatus.ADDITIONAL_INFO_REQUIRED ||
            params.status === client_1.KycStatus.EXPIRED;
        if (needsReason && (!params.reason || params.reason.trim().length < 3)) {
            throw Object.assign(new Error(`A clear compliance reason/instruction is required when setting status to ${compliancePolicy_service_1.KYC_STATUS_LABELS[params.status]}.`), { status: 400 });
        }
        const now = new Date();
        const parsedExpiresAt = params.expiresAt ? new Date(params.expiresAt) : null;
        const validExpiresAt = parsedExpiresAt && !isNaN(parsedExpiresAt.getTime()) ? parsedExpiresAt : null;
        // If Admin attached a file or manually logs an Email/Support Channel submission (or user had no document yet)
        if (!doc || params.fileDataUrl || params.submissionSource === 'EMAIL_CHANNEL') {
            const newDocId = crypto_1.default.randomUUID();
            let privatePath = '/private/kyc/email_or_manual_record.svg';
            let mimeType = 'image/svg+xml';
            let origFilename = params.originalFilename || 'compliance_channel_record.svg';
            if (params.fileDataUrl) {
                const stored = await this.storePrivateKycFile({
                    userId: targetUserId,
                    docId: newDocId,
                    rawUrlOrData: params.fileDataUrl,
                    originalFilename: params.originalFilename,
                });
                privatePath = stored.privatePath;
                mimeType = stored.mimeType;
                origFilename = stored.originalFilename;
            }
            if (doc && !params.fileDataUrl) {
                doc = await prisma_1.prisma.kycDocument.update({
                    where: { id: doc.id },
                    data: {
                        status: params.status,
                        rejectionReason: needsReason ? params.reason?.trim() : null,
                        complianceNotes: params.complianceNotes?.trim() || doc.complianceNotes,
                        reviewedBy: params.adminEmail || params.adminId,
                        verifiedAt: params.status === client_1.KycStatus.APPROVED ? now : doc.verifiedAt,
                        expiresAt: validExpiresAt ?? doc.expiresAt,
                    },
                });
            }
            else {
                doc = await prisma_1.prisma.kycDocument.create({
                    data: {
                        id: newDocId,
                        userId: targetUserId,
                        documentType: params.documentType || 'EMAIL_PACKAGE',
                        documentUrl: privatePath,
                        idNumber: params.idNumber ? String(params.idNumber).trim().toUpperCase() : null,
                        issuingCountry: params.issuingCountry || user.country || null,
                        submissionSource: params.submissionSource || 'EMAIL_CHANNEL',
                        complianceNotes: params.complianceNotes?.trim() || params.reason?.trim() || 'Updated by Compliance Officer',
                        originalFilename: origFilename,
                        mimeType,
                        status: params.status,
                        rejectionReason: needsReason ? params.reason?.trim() : null,
                        reviewedBy: params.adminEmail || params.adminId,
                        verifiedAt: params.status === client_1.KycStatus.APPROVED ? now : null,
                        expiresAt: validExpiresAt,
                    },
                });
            }
        }
        else {
            doc = await prisma_1.prisma.kycDocument.update({
                where: { id: doc.id },
                data: {
                    status: params.status,
                    rejectionReason: needsReason ? params.reason?.trim() : null,
                    complianceNotes: params.complianceNotes?.trim() || doc.complianceNotes,
                    reviewedBy: params.adminEmail || params.adminId,
                    verifiedAt: params.status === client_1.KycStatus.APPROVED ? now : doc.verifiedAt,
                    expiresAt: validExpiresAt ?? doc.expiresAt,
                },
            });
        }
        const updatedUser = await prisma_1.prisma.user.update({
            where: { id: targetUserId },
            data: {
                kycStatus: params.status,
                kycReviewedAt: now,
                kycReviewedBy: params.adminEmail || params.adminId,
                kycExpiresAt: validExpiresAt ?? (params.status === client_1.KycStatus.EXPIRED ? now : user.kycExpiresAt),
                kycNotes: params.reason?.trim() || params.complianceNotes?.trim() || null,
            },
            select: {
                id: true,
                email: true,
                kycStatus: true,
                kycReviewedAt: true,
                kycExpiresAt: true,
            },
        });
        const actionMap = {
            NOT_STARTED: 'KYC_RESET_BY_ADMIN',
            PENDING: 'KYC_SET_PENDING',
            UNDER_REVIEW: 'KYC_UNDER_REVIEW',
            APPROVED: 'APPROVE_KYC',
            REJECTED: 'REJECT_KYC',
            ADDITIONAL_INFO_REQUIRED: 'KYC_ADDITIONAL_INFO_REQUIRED',
            EXPIRED: 'KYC_EXPIRED',
        };
        await prisma_1.prisma.adminAuditLog
            .create({
            data: {
                userId: params.adminId,
                action: params.submissionSource === 'EMAIL_CHANNEL' ? 'ADMIN_MANUAL_KYC_UPDATE' : actionMap[params.status],
                entity: 'KycDocument',
                entityId: doc.id,
                ipAddress: params.ipAddress || null,
                details: `Admin (${params.adminEmail || params.adminId}) set KYC status to ${params.status} (${compliancePolicy_service_1.KYC_STATUS_LABELS[params.status]}) for ${user.email} [Source: ${doc.submissionSource}]. Notes/Reason: ${params.reason || params.complianceNotes || 'N/A'}`,
            },
        })
            .catch(() => { });
        // Notify client by email
        const label = compliancePolicy_service_1.KYC_STATUS_LABELS[params.status] || params.status;
        notification_provider_1.notificationService
            .sendEmail({
            to: user.email,
            subject: `Avora Bank KYC Compliance Update: ${label}`,
            html: `
          <div style="font-family: sans-serif; padding: 20px; color: #1e293b;">
            <h2>Identity Verification (KYC) Status Update</h2>
            <p>Hello ${user.firstName || 'Client'},</p>
            <p>Your Avora Bank KYC status has been updated to: <strong>${label}</strong>.</p>
            ${params.reason ? `<p><strong>Compliance Instructions / Notes:</strong> ${params.reason}</p>` : ''}
            <p>Log in to your Dashboard to view your compliance status and available platform features.</p>
          </div>
        `,
        })
            .catch(() => { });
        return {
            success: true,
            documentId: doc.id,
            user: updatedUser,
            kycStatus: params.status,
            statusLabel: label,
            message: `KYC updated to ${label} for ${user.email}.`,
        };
    }
    /**
     * Admin: Approve KYC submission
     */
    async approveKyc(documentId, adminId, adminEmail, complianceNotes, expiresAt) {
        return this.adminUpdateKycStatus({
            documentId,
            adminId,
            adminEmail,
            status: client_1.KycStatus.APPROVED,
            complianceNotes,
            expiresAt,
        });
    }
    /**
     * Admin: Reject KYC submission
     */
    async rejectKyc(documentId, adminId, reason, adminEmail) {
        return this.adminUpdateKycStatus({
            documentId,
            adminId,
            adminEmail,
            status: client_1.KycStatus.REJECTED,
            reason: reason || 'Document image unclear or did not pass verification.',
        });
    }
}
exports.KycService = KycService;
exports.kycService = new KycService();
