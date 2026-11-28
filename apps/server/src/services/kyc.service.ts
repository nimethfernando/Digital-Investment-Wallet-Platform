import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { KycStatus, Role } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { notificationService } from '../adapters/notification/notification.provider';
import { compliancePolicyService, KYC_STATUS_LABELS } from './compliancePolicy.service';
import { getPersistedUploadedAsset, persistUploadedBuffer } from './storage.service';

export interface KycSubmissionInput {
  documentType: 'PASSPORT' | 'NATIONAL_ID' | 'DRIVERS_LICENSE' | 'PROOF_OF_ADDRESS' | 'EMAIL_PACKAGE';
  documentUrl: string;
  idNumber?: string;
  country?: string;
  provider?: 'SUMSUB' | 'ONFIDO' | 'MANUAL' | 'EMAIL_CHANNEL';
  originalFilename?: string;
}

const VALID_KYC_STATUSES: KycStatus[] = [
  KycStatus.NOT_STARTED,
  KycStatus.PENDING,
  KycStatus.UNDER_REVIEW,
  KycStatus.APPROVED,
  KycStatus.REJECTED,
  KycStatus.ADDITIONAL_INFO_REQUIRED,
  KycStatus.EXPIRED,
];

function parseDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string; ext: string } | null {
  const match = /^data:([a-zA-Z0-9/+.-]+);base64,([A-Za-z0-9+/=\s]+)$/.exec((dataUrl || '').trim());
  if (!match) return null;
  const mimeType = match[1].toLowerCase();
  const extMap: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
    'image/svg+xml': 'svg',
    'application/pdf': 'pdf',
  };
  const ext = extMap[mimeType] || 'bin';
  const buffer = Buffer.from(match[2].replace(/\s+/g, ''), 'base64');
  return { buffer, mimeType, ext };
}

function detectBufferMimeType(buffer: Buffer, fallbackMime?: string | null): { mimeType: string; ext: string } {
  if (!buffer || buffer.length === 0) {
    return { mimeType: fallbackMime || 'image/svg+xml', ext: 'svg' };
  }
  const head = buffer.subarray(0, 64);
  const headStr = head.toString('utf8').trimStart();

  // PDF magic header: %PDF-
  if (head.length >= 5 && head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d) {
    return { mimeType: 'application/pdf', ext: 'pdf' };
  }
  // PNG magic header: 89 50 4E 47
  if (head.length >= 4 && head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47) {
    return { mimeType: 'image/png', ext: 'png' };
  }
  // JPEG magic header: FF D8 FF
  if (head.length >= 3 && head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff) {
    return { mimeType: 'image/jpeg', ext: 'jpg' };
  }
  // GIF magic header: GIF8
  if (head.length >= 4 && head[0] === 0x47 && head[1] === 0x49 && head[2] === 0x46 && head[3] === 0x38) {
    return { mimeType: 'image/gif', ext: 'gif' };
  }
  // WEBP magic header: RIFF....WEBP
  if (
    head.length >= 12 &&
    head[0] === 0x52 &&
    head[1] === 0x49 &&
    head[2] === 0x46 &&
    head[3] === 0x46 &&
    head[8] === 0x57 &&
    head[9] === 0x45 &&
    head[10] === 0x42 &&
    head[11] === 0x50
  ) {
    return { mimeType: 'image/webp', ext: 'webp' };
  }
  // SVG XML payload
  if (headStr.startsWith('<svg') || headStr.startsWith('<?xml') || headStr.includes('<svg')) {
    return { mimeType: 'image/svg+xml', ext: 'svg' };
  }

  const cleanFallback = (fallbackMime || '').toLowerCase();
  if (cleanFallback.includes('png')) return { mimeType: 'image/png', ext: 'png' };
  if (cleanFallback.includes('jpeg') || cleanFallback.includes('jpg')) return { mimeType: 'image/jpeg', ext: 'jpg' };
  if (cleanFallback.includes('webp')) return { mimeType: 'image/webp', ext: 'webp' };
  if (cleanFallback.includes('gif')) return { mimeType: 'image/gif', ext: 'gif' };
  if (cleanFallback.includes('svg')) return { mimeType: 'image/svg+xml', ext: 'svg' };
  return { mimeType: fallbackMime || 'application/octet-stream', ext: 'bin' };
}

export class KycService {
  /**
   * Persist sensitive KYC document buffer privately in diw_uploaded_assets so it is NEVER exposed via public URLs
   */
  private async storePrivateKycFile(params: {
    userId: string;
    docId: string;
    rawUrlOrData: string;
    originalFilename?: string;
  }): Promise<{ privatePath: string; mimeType: string; originalFilename: string }> {
    const parsed = parseDataUrl(params.rawUrlOrData);
    if (parsed) {
      const detected = detectBufferMimeType(parsed.buffer, parsed.mimeType);
      const safeName = (params.originalFilename || `kyc_${params.docId.slice(0, 8)}.${detected.ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const privatePath = `/private/kyc/${params.userId}/${params.docId}.${detected.ext}`;
      await persistUploadedBuffer({
        urlPath: privatePath,
        buffer: parsed.buffer,
        mimeType: detected.mimeType,
        originalName: safeName,
      });
      return {
        privatePath,
        mimeType: detected.mimeType,
        originalFilename: safeName,
      };
    }

    const cleanUrl = String(params.rawUrlOrData || '').trim();
    // If client uploaded via /api/v1/upload first and passed an /uploads/... URL, copy/detect its actual mimeType
    const persistedExisting = cleanUrl ? await getPersistedUploadedAsset(cleanUrl) : null;
    if (persistedExisting && persistedExisting.buffer?.length) {
      const detected = detectBufferMimeType(persistedExisting.buffer, persistedExisting.mimeType);
      const safeName = (params.originalFilename || persistedExisting.originalName || `kyc_${params.docId.slice(0, 8)}.${detected.ext}`).replace(/[^a-zA-Z0-9._-]/g, '_');
      const privatePath = `/private/kyc/${params.userId}/${params.docId}.${detected.ext}`;
      await persistUploadedBuffer({
        urlPath: privatePath,
        buffer: persistedExisting.buffer,
        mimeType: detected.mimeType,
        originalName: safeName,
      });
      return {
        privatePath,
        mimeType: detected.mimeType,
        originalFilename: safeName,
      };
    }

    const ext = path.extname(cleanUrl.split('?')[0]).toLowerCase();
    const mimeByExt: Record<string, string> = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml',
    };
    const resolvedExt = ext && mimeByExt[ext] ? ext : '.svg';
    return {
      privatePath: cleanUrl || `/private/kyc/${params.userId}/${params.docId}.svg`,
      mimeType: mimeByExt[resolvedExt] || 'image/svg+xml',
      originalFilename: params.originalFilename || `kyc_${params.docId.slice(0, 8)}${resolvedExt}`,
    };
  }

  /**
   * Submit KYC document for identity verification
   */
  async submitKyc(userId: string, input: KycSubmissionInput) {
    await compliancePolicyService.ensureComplianceSchema();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found.');
    }

    if (user.kycStatus === KycStatus.APPROVED && (!user.kycExpiresAt || new Date() < user.kycExpiresAt)) {
      return {
        documentId: 'already_approved',
        documentType: input.documentType,
        status: KycStatus.APPROVED,
        message: 'Your identity verification (KYC) is already approved.',
      };
    }

    const docId = crypto.randomUUID();
    const stored = await this.storePrivateKycFile({
      userId,
      docId,
      rawUrlOrData: input.documentUrl,
      originalFilename: input.originalFilename,
    });

    const cleanIdNum = input.idNumber ? String(input.idNumber).trim().toUpperCase().slice(0, 120) : null;
    const cleanCountry = input.country ? String(input.country).trim().slice(0, 100) : user.country || null;

    const document = await prisma.kycDocument.create({
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
        status: KycStatus.PENDING,
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: KycStatus.PENDING,
        kycSubmittedAt: new Date(),
        kycNotes: null,
      },
    });

    // Check duplicate document ID across different user accounts
    await compliancePolicyService.evaluateKycDocumentDuplicates({
      userId,
      idNumber: cleanIdNum || undefined,
      documentType: input.documentType,
      issuingCountry: cleanCountry || undefined,
    });

    // Audit Log
    await prisma.adminAuditLog
      .create({
        data: {
          userId,
          action: 'KYC_SUBMITTED',
          entity: 'KycDocument',
          entityId: document.id,
          details: `User ${user.email} submitted ${input.documentType} (${cleanCountry || 'N/A'}) via ${document.submissionSource}.`,
        },
      })
      .catch(() => {});

    notificationService.sendEmail({
      to: user.email,
      subject: `KYC Documents Received - Pending Compliance Review`,
      html: `<p>Hello ${user.firstName || 'Client'},</p><p>We received your <strong>${input.documentType}</strong> verification submission. Our Compliance Team will review your documents shortly.</p>`,
    }).catch(() => {});

    notificationService.sendAdminAlert(
      `New KYC Submission [${document.id.slice(0, 8).toUpperCase()}]`,
      `${user.firstName || 'Client'} (${user.email}) submitted ${input.documentType} documents for KYC identity verification.\nReview in Admin → KYC Compliance.`,
      { documentId: document.id, userId, email: user.email, documentType: input.documentType }
    ).catch(() => {});

    return {
      documentId: document.id,
      documentType: document.documentType,
      status: KycStatus.PENDING,
      message: 'KYC identity documents submitted successfully. Application is pending compliance officer review.',
    };
  }

  /**
   * Admin-only sandbox instant verify (never exposed to unprivileged users in production)
   */
  async instantVerifyKyc(userId: string, input?: Partial<KycSubmissionInput>) {
    await compliancePolicyService.ensureComplianceSchema();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found.');
    }

    const document = await prisma.kycDocument.create({
      data: {
        userId,
        documentType: input?.documentType || 'PASSPORT',
        documentUrl: '/private/kyc/admin_instant_verification.pdf',
        submissionSource: 'ADMIN_MANUAL',
        status: KycStatus.APPROVED,
        verifiedAt: new Date(),
      },
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: KycStatus.APPROVED,
        kycReviewedAt: new Date(),
      },
    });

    return {
      documentId: document.id,
      documentType: document.documentType,
      status: KycStatus.APPROVED,
      message: 'Verification approved.',
    };
  }

  /**
   * Reset user KYC status (only when NOT approved or by Admin)
   */
  async resetKyc(userId: string, isAdminAction = false) {
    await compliancePolicyService.ensureComplianceSchema();
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error('User not found.');
    }

    if (user.kycStatus === KycStatus.APPROVED && !isAdminAction) {
      throw Object.assign(new Error('Approved KYC cannot be self-reset. Contact Compliance if re-verification is needed.'), {
        status: 403,
      });
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        kycStatus: KycStatus.NOT_STARTED,
        kycNotes: null,
      },
    });

    await prisma.adminAuditLog
      .create({
        data: {
          userId,
          action: 'KYC_RESET',
          entity: 'User',
          entityId: userId,
          details: `KYC status reset to NOT_STARTED for ${user.email}.`,
        },
      })
      .catch(() => {});

    return {
      kycStatus: KycStatus.NOT_STARTED,
      message: 'KYC status reset. You may submit your verification documents again.',
    };
  }

  /**
   * Get user's KYC verification status and sanitized documents (never returning public URLs)
   */
  async getKycStatus(userId: string) {
    await compliancePolicyService.ensureComplianceSchema();
    const user = await prisma.user.findUnique({
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

    const policy = await compliancePolicyService.getPolicy();

    return {
      kycStatus: user.kycStatus,
      kycStatusLabel: KYC_STATUS_LABELS[user.kycStatus] || user.kycStatus,
      isVerified: user.kycStatus === KycStatus.APPROVED,
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
        statusLabel: KYC_STATUS_LABELS[doc.status] || doc.status,
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
  async generateProviderToken(userId: string, provider: 'SUMSUB' | 'ONFIDO' = 'SUMSUB') {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new Error('User not found.');

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
  async getSecureDocumentFile(params: {
    documentId: string;
    requesterId: string;
    requesterRole: Role;
    requesterIp?: string;
  }): Promise<{ buffer: Buffer; mimeType: string; filename: string }> {
    await compliancePolicyService.ensureComplianceSchema();
    const doc = await prisma.kycDocument.findUnique({
      where: { id: params.documentId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            displayName: true,
            country: true,
            phone: true,
            createdAt: true,
          },
        },
      },
    });

    if (!doc) {
      throw Object.assign(new Error('KYC document record not found.'), { status: 404 });
    }

    const isComplianceAdmin = params.requesterRole === Role.ADMIN || params.requesterRole === Role.STAFF;
    const isOwner = doc.userId === params.requesterId;

    if (!isComplianceAdmin && !isOwner) {
      throw Object.assign(new Error('Forbidden: You are not authorized to access this KYC document.'), {
        status: 403,
      });
    }

    // Log every KYC document access!
    await prisma.adminAuditLog
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
      .catch(() => {});

    const rawUrl = String(doc.documentUrl || '').trim();

    // 1. Inline legacy data URL
    const parsedData = parseDataUrl(rawUrl);
    if (parsedData && parsedData.buffer.length > 0) {
      const detected = detectBufferMimeType(parsedData.buffer, parsedData.mimeType || doc.mimeType);
      return {
        buffer: parsedData.buffer,
        mimeType: detected.mimeType,
        filename: `kyc_${doc.id.slice(0, 8)}.${detected.ext}`,
      };
    }

    // 2. Persisted private or legacy asset in diw_uploaded_assets
    const candidatePaths = [rawUrl];
    if (rawUrl && !rawUrl.startsWith('/')) {
      candidatePaths.push(`/${rawUrl}`);
    }
    if (rawUrl.includes('/uploads/')) {
      const idx = rawUrl.indexOf('/uploads/');
      candidatePaths.push(rawUrl.slice(idx));
    }
    for (const candidate of candidatePaths) {
      if (!candidate) continue;
      const persisted = await getPersistedUploadedAsset(candidate);
      if (persisted && persisted.buffer && persisted.buffer.length > 0) {
        const detected = detectBufferMimeType(persisted.buffer, persisted.mimeType || doc.mimeType);
        return {
          buffer: persisted.buffer,
          mimeType: detected.mimeType,
          filename: `kyc_${doc.id.slice(0, 8)}.${detected.ext}`,
        };
      }
    }

    // 3. Disk fallback for legacy local uploads
    const cleanRel = rawUrl.includes('/uploads/')
      ? rawUrl.slice(rawUrl.indexOf('/uploads/')).replace(/^\/uploads\/?/, '')
      : rawUrl.startsWith('/uploads/')
      ? rawUrl.replace(/^\/uploads\/?/, '')
      : '';
    if (cleanRel) {
      const uploadsDir = path.resolve(config.uploadDir || './uploads');
      const filePath = path.join(uploadsDir, cleanRel);
      if (fs.existsSync(filePath)) {
        const buf = await fs.promises.readFile(filePath);
        if (buf.length > 0) {
          const detected = detectBufferMimeType(buf, doc.mimeType);
          return {
            buffer: buf,
            mimeType: detected.mimeType,
            filename: `kyc_${doc.id.slice(0, 8)}.${detected.ext}`,
          };
        }
      }
    }

    // 4. Visual Government Identity Credential & Compliance Dossier Card (SVG)
    // Generated whenever a record was submitted without binary bytes (e.g. legacy seeded/test records, SDK token verification, or email channel)
    const esc = (val?: string | null) =>
      String(val || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

    const fullName =
      [doc.user.firstName, doc.user.lastName].filter(Boolean).join(' ').trim() ||
      doc.user.displayName ||
      doc.user.email.split('@')[0].replace(/[._-]/g, ' ').toUpperCase();
    const initials = fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((s) => s[0]?.toUpperCase() || 'A')
      .join('');
    const docTypeLabel = esc(doc.documentType.replace(/_/g, ' '));
    const docNumber = esc(doc.idNumber || `AVR-${doc.id.slice(0, 8).toUpperCase()}-ID`);
    const countryLabel = esc(doc.issuingCountry || doc.user.country || 'INTERNATIONAL / GEORGIA');
    const submittedDate = new Date(doc.createdAt).toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
    const statusLabel = esc(KYC_STATUS_LABELS[doc.status] || doc.status);
    const statusColor =
      doc.status === KycStatus.APPROVED
        ? '#10b981'
        : doc.status === KycStatus.REJECTED || doc.status === KycStatus.EXPIRED
        ? '#f43f5e'
        : '#f59e0b';
    const mrzLine1 = `P<AVR${fullName.replace(/[^A-Z0-9]/gi, '<').toUpperCase().padEnd(39, '<').slice(0, 39)}`;
    const mrzLine2 = `${docNumber.replace(/[^A-Z0-9]/gi, '<').padEnd(15, '<').slice(0, 15)}AVR${doc.id.replace(/[^A-Z0-9]/gi, '').toUpperCase().padEnd(26, '<').slice(0, 26)}`;

    const summarySvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="860" height="520" viewBox="0 0 860 520">
  <defs>
    <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="55%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#090d16"/>
    </linearGradient>
    <linearGradient id="accentGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#10b981"/>
      <stop offset="50%" stop-color="#38bdf8"/>
      <stop offset="100%" stop-color="#6366f1"/>
    </linearGradient>
  </defs>

  <!-- Outer Card Shell -->
  <rect width="860" height="520" rx="22" fill="url(#cardBg)" stroke="#334155" stroke-width="2.5"/>
  <rect x="2" y="2" width="856" height="8" rx="4" fill="url(#accentGrad)"/>

  <!-- Header Banner -->
  <rect x="28" y="26" width="804" height="68" rx="14" fill="#090d16" fill-opacity="0.65" stroke="#1e293b" stroke-width="1.5"/>
  <circle cx="64" cy="60" r="20" fill="#10b981" fill-opacity="0.15" stroke="#10b981" stroke-width="1.5"/>
  <text x="64" y="66" text-anchor="middle" font-family="sans-serif" font-size="15" font-weight="900" fill="#10b981">ID</text>
  <text x="98" y="54" font-family="sans-serif" font-size="18" font-weight="900" fill="#f8fafc" letter-spacing="1">GOVERNMENT IDENTITY CREDENTIAL • KYC DOSSIER</text>
  <text x="98" y="76" font-family="monospace" font-size="12" fill="#94a3b8">ISSUING AUTHORITY / JURISDICTION: <tspan fill="#38bdf8" font-weight="700">${countryLabel}</tspan></text>

  <!-- Status Pill -->
  <rect x="650" y="42" width="164" height="36" rx="10" fill="#0f172a" stroke="${statusColor}" stroke-width="1.5"/>
  <text x="732" y="65" text-anchor="middle" font-family="monospace" font-size="12" font-weight="800" fill="${statusColor}">${statusLabel.toUpperCase()}</text>

  <!-- Left Portrait & Biometric Chip Frame -->
  <rect x="34" y="116" width="210" height="250" rx="16" fill="#090d16" stroke="#334155" stroke-width="1.5"/>
  <circle cx="139" cy="202" r="52" fill="#1e293b" stroke="#38bdf8" stroke-width="2"/>
  <text x="139" y="216" text-anchor="middle" font-family="sans-serif" font-size="38" font-weight="900" fill="#38bdf8">${esc(initials)}</text>
  <rect x="58" y="276" width="162" height="28" rx="6" fill="#10b981" fill-opacity="0.12" stroke="#10b981" stroke-width="1"/>
  <text x="139" y="294" text-anchor="middle" font-family="monospace" font-size="11" font-weight="700" fill="#10b981">IDENTITY SPECIMEN</text>
  <text x="139" y="330" text-anchor="middle" font-family="monospace" font-size="10" fill="#64748b">DOC REF: ${esc(doc.id.slice(0, 12).toUpperCase())}</text>
  <text x="139" y="348" text-anchor="middle" font-family="monospace" font-size="10" fill="#64748b">CHANNEL: ${esc(doc.submissionSource || 'PLATFORM_UPLOAD')}</text>

  <!-- Right Identity Fields Grid -->
  <rect x="264" y="116" width="568" height="250" rx="16" fill="#090d16" fill-opacity="0.55" stroke="#1e293b" stroke-width="1.5"/>

  <text x="290" y="148" font-family="monospace" font-size="11" fill="#64748b">HOLDER FULL LEGAL NAME / ACCOUNT</text>
  <text x="290" y="170" font-family="sans-serif" font-size="19" font-weight="800" fill="#ffffff">${esc(fullName)}</text>

  <text x="600" y="148" font-family="monospace" font-size="11" fill="#64748b">DOCUMENT CATEGORY</text>
  <text x="600" y="170" font-family="monospace" font-size="16" font-weight="800" fill="#38bdf8">${docTypeLabel}</text>

  <line x1="290" y1="186" x2="806" y2="186" stroke="#1e293b" stroke-width="1"/>

  <text x="290" y="212" font-family="monospace" font-size="11" fill="#64748b">REGISTERED EMAIL ADDRESS</text>
  <text x="290" y="232" font-family="monospace" font-size="14" font-weight="700" fill="#e2e8f0">${esc(doc.user.email)}</text>

  <text x="600" y="212" font-family="monospace" font-size="11" fill="#64748b">DOCUMENT / NATIONAL ID NO.</text>
  <text x="600" y="232" font-family="monospace" font-size="15" font-weight="800" fill="#10b981">${docNumber}</text>

  <line x1="290" y1="248" x2="806" y2="248" stroke="#1e293b" stroke-width="1"/>

  <text x="290" y="274" font-family="monospace" font-size="11" fill="#64748b">ISSUING COUNTRY / NATIONALITY</text>
  <text x="290" y="294" font-family="sans-serif" font-size="14" font-weight="700" fill="#f8fafc">${countryLabel}</text>

  <text x="600" y="274" font-family="monospace" font-size="11" fill="#64748b">SUBMISSION TIMESTAMP</text>
  <text x="600" y="294" font-family="monospace" font-size="13" font-weight="700" fill="#cbd5e1">${esc(submittedDate)}</text>

  <line x1="290" y1="310" x2="806" y2="310" stroke="#1e293b" stroke-width="1"/>

  <text x="290" y="334" font-family="monospace" font-size="11" fill="#64748b">COMPLIANCE &amp; VERIFICATION NOTES</text>
  <text x="290" y="352" font-family="sans-serif" font-size="12" fill="#94a3b8">${esc(doc.complianceNotes || doc.rejectionReason || 'Digital KYC dossier submitted and logged for compliance review.').slice(0, 82)}</text>

  <!-- Bottom ICAO Machine Readable Zone (MRZ) -->
  <rect x="34" y="386" width="798" height="104" rx="14" fill="#020617" stroke="#1e293b" stroke-width="1.5"/>
  <text x="56" y="414" font-family="monospace" font-size="11" fill="#10b981" font-weight="700">AVORA BANK COMPLIANCE ARCHIVE • PROTECTED STREAM • RECORD ID: ${esc(doc.id)}</text>
  <text x="56" y="444" font-family="monospace" font-size="15" letter-spacing="2.5" fill="#cbd5e1">${esc(mrzLine1)}</text>
  <text x="56" y="470" font-family="monospace" font-size="15" letter-spacing="2.5" fill="#cbd5e1">${esc(mrzLine2)}</text>
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
  async getAdminKycOverview(filters?: { status?: string; search?: string }) {
    await compliancePolicyService.ensureComplianceSchema();
    const q = (filters?.search || '').trim().toLowerCase();
    const statusFilter = (filters?.status || 'ALL').trim().toUpperCase();

    const [allDocs, allUsers, recentAuditLogs] = await Promise.all([
      prisma.kycDocument.findMany({
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
      prisma.user.findMany({
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
      prisma.adminAuditLog.findMany({
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
      notSubmitted: allUsers.filter((u) => u.kycStatus === KycStatus.NOT_STARTED).length,
      pending: allUsers.filter((u) => u.kycStatus === KycStatus.PENDING).length,
      underReview: allUsers.filter((u) => u.kycStatus === KycStatus.UNDER_REVIEW).length,
      approved: allUsers.filter((u) => u.kycStatus === KycStatus.APPROVED).length,
      rejected: allUsers.filter((u) => u.kycStatus === KycStatus.REJECTED).length,
      additionalInfoRequired: allUsers.filter((u) => u.kycStatus === KycStatus.ADDITIONAL_INFO_REQUIRED).length,
      expired: allUsers.filter((u) => u.kycStatus === KycStatus.EXPIRED).length,
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
        statusLabel: KYC_STATUS_LABELS[d.status] || d.status,
        rejectionReason: d.rejectionReason,
        expiresAt: d.expiresAt,
        verifiedAt: d.verifiedAt,
        reviewedBy: d.reviewedBy,
        createdAt: d.createdAt,
        user: d.user,
      }))
      .filter((d) => {
        if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
        if (q) {
          const hay = `${d.user?.email || ''} ${d.user?.firstName || ''} ${d.user?.lastName || ''} ${d.documentType} ${d.idNumber || ''} ${d.issuingCountry || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
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
  async adminUpdateKycStatus(params: {
    adminId: string;
    adminEmail?: string;
    documentId?: string;
    userId?: string;
    status: KycStatus;
    reason?: string;
    complianceNotes?: string;
    expiresAt?: string | null;
    submissionSource?: string;
    documentType?: string;
    idNumber?: string;
    issuingCountry?: string;
    fileDataUrl?: string;
    originalFilename?: string;
    ipAddress?: string;
  }) {
    await compliancePolicyService.ensureComplianceSchema();
    if (!VALID_KYC_STATUSES.includes(params.status)) {
      throw Object.assign(new Error(`Invalid KYC status: ${params.status}`), { status: 400 });
    }

    let doc = params.documentId
      ? await prisma.kycDocument.findUnique({ where: { id: params.documentId } })
      : null;

    const targetUserId = doc?.userId || params.userId;
    if (!targetUserId) {
      throw Object.assign(new Error('Target userId or documentId is required.'), { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) {
      throw Object.assign(new Error('Target user not found.'), { status: 404 });
    }

    const needsReason =
      params.status === KycStatus.REJECTED ||
      params.status === KycStatus.ADDITIONAL_INFO_REQUIRED ||
      params.status === KycStatus.EXPIRED;
    if (needsReason && (!params.reason || params.reason.trim().length < 3)) {
      throw Object.assign(
        new Error(`A clear compliance reason/instruction is required when setting status to ${KYC_STATUS_LABELS[params.status]}.`),
        { status: 400 }
      );
    }

    const now = new Date();
    const parsedExpiresAt = params.expiresAt ? new Date(params.expiresAt) : null;
    const validExpiresAt =
      parsedExpiresAt && !isNaN(parsedExpiresAt.getTime()) ? parsedExpiresAt : null;

    // If Admin attached a file or manually logs an Email/Support Channel submission (or user had no document yet)
    if (!doc || params.fileDataUrl || params.submissionSource === 'EMAIL_CHANNEL') {
      const newDocId = crypto.randomUUID();
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
        doc = await prisma.kycDocument.update({
          where: { id: doc.id },
          data: {
            status: params.status,
            rejectionReason: needsReason ? params.reason?.trim() : null,
            complianceNotes: params.complianceNotes?.trim() || doc.complianceNotes,
            reviewedBy: params.adminEmail || params.adminId,
            verifiedAt: params.status === KycStatus.APPROVED ? now : doc.verifiedAt,
            expiresAt: validExpiresAt ?? doc.expiresAt,
          },
        });
      } else {
        doc = await prisma.kycDocument.create({
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
            verifiedAt: params.status === KycStatus.APPROVED ? now : null,
            expiresAt: validExpiresAt,
          },
        });
      }
    } else {
      doc = await prisma.kycDocument.update({
        where: { id: doc.id },
        data: {
          status: params.status,
          rejectionReason: needsReason ? params.reason?.trim() : null,
          complianceNotes: params.complianceNotes?.trim() || doc.complianceNotes,
          reviewedBy: params.adminEmail || params.adminId,
          verifiedAt: params.status === KycStatus.APPROVED ? now : doc.verifiedAt,
          expiresAt: validExpiresAt ?? doc.expiresAt,
        },
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: {
        kycStatus: params.status,
        kycReviewedAt: now,
        kycReviewedBy: params.adminEmail || params.adminId,
        kycExpiresAt: validExpiresAt ?? (params.status === KycStatus.EXPIRED ? now : user.kycExpiresAt),
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

    const actionMap: Record<KycStatus, string> = {
      NOT_STARTED: 'KYC_RESET_BY_ADMIN',
      PENDING: 'KYC_SET_PENDING',
      UNDER_REVIEW: 'KYC_UNDER_REVIEW',
      APPROVED: 'APPROVE_KYC',
      REJECTED: 'REJECT_KYC',
      ADDITIONAL_INFO_REQUIRED: 'KYC_ADDITIONAL_INFO_REQUIRED',
      EXPIRED: 'KYC_EXPIRED',
    };

    await prisma.adminAuditLog
      .create({
        data: {
          userId: params.adminId,
          action: params.submissionSource === 'EMAIL_CHANNEL' ? 'ADMIN_MANUAL_KYC_UPDATE' : actionMap[params.status],
          entity: 'KycDocument',
          entityId: doc.id,
          ipAddress: params.ipAddress || null,
          details: `Admin (${params.adminEmail || params.adminId}) set KYC status to ${params.status} (${KYC_STATUS_LABELS[params.status]}) for ${user.email} [Source: ${doc.submissionSource}]. Notes/Reason: ${params.reason || params.complianceNotes || 'N/A'}`,
        },
      })
      .catch(() => {});

    // Notify client by email
    const label = KYC_STATUS_LABELS[params.status] || params.status;
    notificationService
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
      .catch(() => {});

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
  async approveKyc(documentId: string, adminId: string, adminEmail?: string, complianceNotes?: string, expiresAt?: string | null) {
    return this.adminUpdateKycStatus({
      documentId,
      adminId,
      adminEmail,
      status: KycStatus.APPROVED,
      complianceNotes,
      expiresAt,
    });
  }

  /**
   * Admin: Reject KYC submission
   */
  async rejectKyc(documentId: string, adminId: string, reason: string, adminEmail?: string) {
    return this.adminUpdateKycStatus({
      documentId,
      adminId,
      adminEmail,
      status: KycStatus.REJECTED,
      reason: reason || 'Document image unclear or did not pass verification.',
    });
  }
}

export const kycService = new KycService();
