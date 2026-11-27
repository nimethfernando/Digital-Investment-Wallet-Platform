import crypto from 'crypto';
import { KycStatus, Role, UserStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { prisma } from '../lib/prisma';
import { config } from '../config';
import { notificationService } from '../adapters/notification/notification.provider';

const POLICY_SETTING_KEY = 'COMPLIANCE_SECURITY_POLICY_V1';

const INSTITUTIONAL_EXEMPT_EMAILS = new Set([
  'admin@avorabank.com',
  'treasury@avorabank.com',
  'tbilisi-desk@avorabank.com',
  'colombo.otc@avorabank.com',
]);

const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com',
  'tempmail.com',
  'temp-mail.org',
  'guerrillamail.com',
  'guerrillamailblock.com',
  '10minutemail.com',
  'yopmail.com',
  'trashmail.com',
  'sharklasers.com',
  'getnada.com',
  'dispostable.com',
  'fakeinbox.com',
  'maildrop.cc',
  'throwawaymail.com',
  'mintemail.com',
  'mohmal.com',
  'emailondeck.com',
]);

export const KYC_STATUS_LABELS: Record<string, string> = {
  NOT_STARTED: 'KYC Not Submitted',
  PENDING: 'KYC Pending',
  UNDER_REVIEW: 'Under Review',
  APPROVED: 'KYC Approved',
  REJECTED: 'KYC Rejected',
  ADDITIONAL_INFO_REQUIRED: 'Additional Information Required',
  EXPIRED: 'KYC Expired / Requires Re-verification',
};

export interface ComplianceSecurityPolicy {
  kycRequiredFeatures: {
    P2P_TRADING: boolean;
    INTERNAL_P2P_TRANSFER: boolean;
    WITHDRAWALS: boolean;
    DEPOSITS: boolean;
    REMITTANCE: boolean;
    OTC_DESK: boolean;
    INSTANT_SWAP: boolean;
    BUY_CRYPTO_ONRAMP: boolean;
    FD_PACKAGES: boolean;
    VENTURE_INVESTMENTS: boolean;
    AVR_TOKEN_SALE: boolean;
    VIRTUAL_CARDS: boolean;
  };
  emailVerification: {
    requireEmailVerificationForSensitiveActions: boolean;
    enforceEmailVerificationOnLoginForNewUsers: boolean;
  };
  captcha: {
    requireOnRegister: boolean;
    requireOnForgotPassword: boolean;
    requireOnLoginAfterFailedAttempts: number;
  };
  duplicateDetection: {
    checkNormalizedEmail: boolean;
    checkPhone: boolean;
    checkSignupIp: boolean;
    maxAccountsPerIp: number;
    checkDeviceFingerprint: boolean;
    checkKycIdNumber: boolean;
    blockDisposableEmailDomains: boolean;
    actionOnDuplicate: 'FLAG_SUSPICIOUS' | 'BLOCK_REGISTRATION';
  };
  newUserLimits: {
    enabled: boolean;
    windowHours: number;
    maxSingleTxUsd: number;
    maxDailyTotalUsd: number;
    blockWithdrawalsDuringWindow: boolean;
  };
  updatedAt?: string | null;
  updatedBy?: string | null;
}

export const DEFAULT_COMPLIANCE_POLICY: ComplianceSecurityPolicy = {
  kycRequiredFeatures: {
    P2P_TRADING: true,
    INTERNAL_P2P_TRANSFER: true,
    WITHDRAWALS: true,
    DEPOSITS: true,
    REMITTANCE: true,
    OTC_DESK: true,
    INSTANT_SWAP: true,
    BUY_CRYPTO_ONRAMP: true,
    FD_PACKAGES: true,
    VENTURE_INVESTMENTS: true,
    AVR_TOKEN_SALE: true,
    VIRTUAL_CARDS: true,
  },
  emailVerification: {
    requireEmailVerificationForSensitiveActions: true,
    enforceEmailVerificationOnLoginForNewUsers: false,
  },
  captcha: {
    requireOnRegister: true,
    requireOnForgotPassword: true,
    requireOnLoginAfterFailedAttempts: 3,
  },
  duplicateDetection: {
    checkNormalizedEmail: true,
    checkPhone: true,
    checkSignupIp: true,
    maxAccountsPerIp: 3,
    checkDeviceFingerprint: true,
    checkKycIdNumber: true,
    blockDisposableEmailDomains: true,
    actionOnDuplicate: 'FLAG_SUSPICIOUS',
  },
  newUserLimits: {
    enabled: true,
    windowHours: 24,
    maxSingleTxUsd: 500,
    maxDailyTotalUsd: 1000,
    blockWithdrawalsDuringWindow: true,
  },
};

export function normalizeEmailAddress(email: string): string {
  const clean = String(email || '').trim().toLowerCase();
  const atIdx = clean.indexOf('@');
  if (atIdx < 1) return clean;
  let local = clean.slice(0, atIdx);
  let domain = clean.slice(atIdx + 1);
  if (domain === 'googlemail.com') domain = 'gmail.com';
  const plusIdx = local.indexOf('+');
  if (plusIdx > 0) {
    local = local.slice(0, plusIdx);
  }
  if (domain === 'gmail.com') {
    local = local.replace(/\./g, '');
  }
  return `${local}@${domain}`;
}

export function isDisposableEmail(email: string): boolean {
  const clean = String(email || '').trim().toLowerCase();
  const domain = clean.split('@')[1] || '';
  return DISPOSABLE_EMAIL_DOMAINS.has(domain);
}

// Track used CAPTCHA nonces in memory (pruned lazily by expiry) to prevent replay attacks
const usedCaptchaNonces = new Map<string, number>();

function getCaptchaSecret(): string {
  return process.env.CAPTCHA_SECRET || config.jwtSecret || 'avora_captcha_hmac_secret_2026';
}

export class CompliancePolicyService {
  private schemaReady = false;

  async ensureComplianceSchema(): Promise<void> {
    if (this.schemaReady) return;
    try {
      const kycEnumSql =
        "ENUM('NOT_STARTED','PENDING','UNDER_REVIEW','APPROVED','REJECTED','ADDITIONAL_INFO_REQUIRED','EXPIRED')";
      await prisma
        .$executeRawUnsafe(
          `ALTER TABLE \`diw_users\` MODIFY COLUMN \`kycStatus\` ${kycEnumSql} NOT NULL DEFAULT 'NOT_STARTED'`
        )
        .catch(() => {});
      await prisma
        .$executeRawUnsafe(
          `ALTER TABLE \`diw_kyc_documents\` MODIFY COLUMN \`status\` ${kycEnumSql} NOT NULL DEFAULT 'PENDING'`
        )
        .catch(() => {});

      const columnChecks: Array<[string, string, string]> = [
        ['diw_users', 'normalizedEmail', 'ALTER TABLE `diw_users` ADD COLUMN `normalizedEmail` VARCHAR(191) NULL'],
        ['diw_users', 'deviceFingerprint', 'ALTER TABLE `diw_users` ADD COLUMN `deviceFingerprint` VARCHAR(128) NULL'],
        ['diw_users', 'kycSubmittedAt', 'ALTER TABLE `diw_users` ADD COLUMN `kycSubmittedAt` DATETIME(3) NULL'],
        ['diw_users', 'kycReviewedAt', 'ALTER TABLE `diw_users` ADD COLUMN `kycReviewedAt` DATETIME(3) NULL'],
        ['diw_users', 'kycReviewedBy', 'ALTER TABLE `diw_users` ADD COLUMN `kycReviewedBy` VARCHAR(191) NULL'],
        ['diw_users', 'kycExpiresAt', 'ALTER TABLE `diw_users` ADD COLUMN `kycExpiresAt` DATETIME(3) NULL'],
        ['diw_users', 'kycNotes', 'ALTER TABLE `diw_users` ADD COLUMN `kycNotes` TEXT NULL'],
        ['diw_users', 'isSuspicious', 'ALTER TABLE `diw_users` ADD COLUMN `isSuspicious` BOOLEAN NOT NULL DEFAULT false'],
        ['diw_users', 'suspiciousReason', 'ALTER TABLE `diw_users` ADD COLUMN `suspiciousReason` TEXT NULL'],
        ['diw_users', 'flaggedAt', 'ALTER TABLE `diw_users` ADD COLUMN `flaggedAt` DATETIME(3) NULL'],
        ['diw_users', 'flaggedBy', 'ALTER TABLE `diw_users` ADD COLUMN `flaggedBy` VARCHAR(191) NULL'],
        ['diw_users', 'riskScore', 'ALTER TABLE `diw_users` ADD COLUMN `riskScore` INT NOT NULL DEFAULT 0'],
        ['diw_users', 'failedLoginAttempts', 'ALTER TABLE `diw_users` ADD COLUMN `failedLoginAttempts` INT NOT NULL DEFAULT 0'],
        ['diw_users', 'lockedUntil', 'ALTER TABLE `diw_users` ADD COLUMN `lockedUntil` DATETIME(3) NULL'],
        ['diw_users', 'bypassNewUserLimits', 'ALTER TABLE `diw_users` ADD COLUMN `bypassNewUserLimits` BOOLEAN NOT NULL DEFAULT false'],
        ['diw_kyc_documents', 'idNumber', 'ALTER TABLE `diw_kyc_documents` ADD COLUMN `idNumber` VARCHAR(120) NULL'],
        ['diw_kyc_documents', 'issuingCountry', 'ALTER TABLE `diw_kyc_documents` ADD COLUMN `issuingCountry` VARCHAR(100) NULL'],
        ['diw_kyc_documents', 'submissionSource', "ALTER TABLE `diw_kyc_documents` ADD COLUMN `submissionSource` VARCHAR(50) NOT NULL DEFAULT 'PLATFORM_UPLOAD'"],
        ['diw_kyc_documents', 'complianceNotes', 'ALTER TABLE `diw_kyc_documents` ADD COLUMN `complianceNotes` TEXT NULL'],
        ['diw_kyc_documents', 'originalFilename', 'ALTER TABLE `diw_kyc_documents` ADD COLUMN `originalFilename` VARCHAR(255) NULL'],
        ['diw_kyc_documents', 'mimeType', 'ALTER TABLE `diw_kyc_documents` ADD COLUMN `mimeType` VARCHAR(120) NULL'],
        ['diw_kyc_documents', 'expiresAt', 'ALTER TABLE `diw_kyc_documents` ADD COLUMN `expiresAt` DATETIME(3) NULL'],
      ];

      for (const [tableName, colName, ddl] of columnChecks) {
        const rows = (await prisma
          .$queryRawUnsafe<any[]>(
            `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
            tableName,
            colName
          )
          .catch(() => [] as any[])) as any[];
        if (Number(rows?.[0]?.cnt || 0) === 0) {
          await prisma.$executeRawUnsafe(ddl).catch(() => {});
        }
      }

      // Ensure existing admin/institutional accounts are marked emailVerified so they remain seamless
      await prisma.user
        .updateMany({
          where: {
            OR: [
              { role: { in: [Role.ADMIN, Role.STAFF] } },
              { email: { in: Array.from(INSTITUTIONAL_EXEMPT_EMAILS) } },
            ],
            emailVerified: false,
          },
          data: { emailVerified: true },
        })
        .catch(() => {});

      this.schemaReady = true;
    } catch (err) {
      console.warn('[CompliancePolicyService] ensureComplianceSchema warning:', err);
    }
  }

  async getPolicy(): Promise<ComplianceSecurityPolicy> {
    try {
      const row = await prisma.cmsSetting.findUnique({ where: { key: POLICY_SETTING_KEY } });
      if (!row?.value) return { ...DEFAULT_COMPLIANCE_POLICY };
      const parsed = JSON.parse(row.value) || {};
      return {
        kycRequiredFeatures: {
          ...DEFAULT_COMPLIANCE_POLICY.kycRequiredFeatures,
          ...(parsed.kycRequiredFeatures || {}),
        },
        emailVerification: {
          ...DEFAULT_COMPLIANCE_POLICY.emailVerification,
          ...(parsed.emailVerification || {}),
        },
        captcha: {
          ...DEFAULT_COMPLIANCE_POLICY.captcha,
          ...(parsed.captcha || {}),
        },
        duplicateDetection: {
          ...DEFAULT_COMPLIANCE_POLICY.duplicateDetection,
          ...(parsed.duplicateDetection || {}),
        },
        newUserLimits: {
          ...DEFAULT_COMPLIANCE_POLICY.newUserLimits,
          ...(parsed.newUserLimits || {}),
        },
        updatedAt: parsed.updatedAt || null,
        updatedBy: parsed.updatedBy || null,
      };
    } catch {
      return { ...DEFAULT_COMPLIANCE_POLICY };
    }
  }

  async updatePolicy(
    patch: Partial<ComplianceSecurityPolicy>,
    adminId: string,
    adminEmail?: string
  ): Promise<ComplianceSecurityPolicy> {
    const current = await this.getPolicy();
    const next: ComplianceSecurityPolicy = {
      kycRequiredFeatures: {
        ...current.kycRequiredFeatures,
        ...(patch.kycRequiredFeatures || {}),
      },
      emailVerification: {
        ...current.emailVerification,
        ...(patch.emailVerification || {}),
      },
      captcha: {
        ...current.captcha,
        ...(patch.captcha || {}),
      },
      duplicateDetection: {
        ...current.duplicateDetection,
        ...(patch.duplicateDetection || {}),
      },
      newUserLimits: {
        ...current.newUserLimits,
        ...(patch.newUserLimits || {}),
      },
      updatedAt: new Date().toISOString(),
      updatedBy: adminEmail || adminId,
    };

    await prisma.cmsSetting.upsert({
      where: { key: POLICY_SETTING_KEY },
      update: { value: JSON.stringify(next) },
      create: {
        key: POLICY_SETTING_KEY,
        group: 'COMPLIANCE',
        value: JSON.stringify(next),
        description: 'KYC feature gating, email verification, CAPTCHA, duplicate detection, and new-user limit configuration',
      },
    });

    await prisma.adminAuditLog
      .create({
        data: {
          userId: adminId,
          action: 'COMPLIANCE_POLICY_UPDATED',
          entity: 'CompliancePolicy',
          entityId: POLICY_SETTING_KEY,
          details: `Updated compliance & KYC gating policy by ${adminEmail || adminId}: ${JSON.stringify(next)}`,
        },
      })
      .catch(() => {});

    return next;
  }

  /**
   * Generate a self-hosted cryptographic visual SVG CAPTCHA challenge
   */
  generateCaptchaChallenge(): {
    captchaToken: string;
    svgDataUrl: string;
  } {
    const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 5; i++) {
      code += alphabet[crypto.randomInt(0, alphabet.length)];
    }

    const nonce = crypto.randomBytes(12).toString('hex');
    const exp = Date.now() + 5 * 60 * 1000;
    const answerHash = crypto
      .createHash('sha256')
      .update(`${nonce}:${code.toUpperCase()}`)
      .digest('hex');

    const payload = Buffer.from(JSON.stringify({ n: nonce, h: answerHash, e: exp })).toString('base64url');
    const sig = crypto.createHmac('sha256', getCaptchaSecret()).update(payload).digest('base64url');
    const captchaToken = `${payload}.${sig}`;

    // Build high-contrast SVG with slight rotation + noise curves so bots cannot trivially parse
    const charsSvg = code
      .split('')
      .map((ch, idx) => {
        const x = 22 + idx * 32 + crypto.randomInt(-2, 3);
        const y = 36 + crypto.randomInt(-4, 5);
        const rot = crypto.randomInt(-16, 17);
        const colors = ['#10b981', '#38bdf8', '#f8fafc', '#a7f3d0', '#fbbf24'];
        const col = colors[idx % colors.length];
        return `<text x="${x}" y="${y}" transform="rotate(${rot} ${x} ${y})" font-family="monospace" font-size="24" font-weight="900" fill="${col}">${ch}</text>`;
      })
      .join('');

    const linesSvg = Array.from({ length: 4 })
      .map(() => {
        const x1 = crypto.randomInt(0, 40);
        const y1 = crypto.randomInt(8, 46);
        const x2 = crypto.randomInt(140, 185);
        const y2 = crypto.randomInt(8, 46);
        return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#334155" stroke-width="1.2" opacity="0.7" />`;
      })
      .join('');

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="190" height="54" viewBox="0 0 190 54"><rect width="190" height="54" rx="10" fill="#090d16" stroke="#1e293b" stroke-width="1.5"/>${linesSvg}${charsSvg}</svg>`;
    const svgDataUrl = `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;

    return { captchaToken, svgDataUrl };
  }

  verifyCaptchaChallenge(captchaToken?: string, answer?: string): void {
    if (!captchaToken || !answer) {
      throw Object.assign(new Error('Security verification CAPTCHA code is required.'), {
        status: 400,
        code: 'CAPTCHA_REQUIRED',
      });
    }

    const parts = String(captchaToken).split('.');
    if (parts.length !== 2) {
      throw Object.assign(new Error('Invalid CAPTCHA challenge token. Please refresh and try again.'), {
        status: 400,
        code: 'CAPTCHA_INVALID',
      });
    }

    const [payload, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', getCaptchaSecret()).update(payload).digest('base64url');
    if (sig !== expectedSig) {
      throw Object.assign(new Error('Invalid CAPTCHA signature. Please refresh and try again.'), {
        status: 400,
        code: 'CAPTCHA_INVALID',
      });
    }

    let decoded: { n: string; h: string; e: number };
    try {
      decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    } catch {
      throw Object.assign(new Error('Malformed CAPTCHA token.'), { status: 400, code: 'CAPTCHA_INVALID' });
    }

    if (!decoded.e || Date.now() > decoded.e) {
      throw Object.assign(new Error('CAPTCHA expired. Please refresh and enter the new code.'), {
        status: 400,
        code: 'CAPTCHA_EXPIRED',
      });
    }

    // Prune old nonces
    const now = Date.now();
    for (const [k, exp] of usedCaptchaNonces.entries()) {
      if (exp < now) usedCaptchaNonces.delete(k);
    }

    if (usedCaptchaNonces.has(decoded.n)) {
      throw Object.assign(new Error('This CAPTCHA has already been used. Please refresh for a new code.'), {
        status: 400,
        code: 'CAPTCHA_REPLAYED',
      });
    }

    const providedHash = crypto
      .createHash('sha256')
      .update(`${decoded.n}:${String(answer).trim().toUpperCase()}`)
      .digest('hex');

    if (providedHash !== decoded.h) {
      throw Object.assign(new Error('Incorrect CAPTCHA security code. Please check and try again.'), {
        status: 400,
        code: 'CAPTCHA_MISMATCH',
      });
    }

    usedCaptchaNonces.set(decoded.n, decoded.e);
  }

  /**
   * Detect duplicate account signals during registration
   */
  async evaluateRegistrationSignals(params: {
    email: string;
    phone?: string;
    signupIp?: string;
    deviceFingerprint?: string;
  }): Promise<{
    normalizedEmail: string;
    isSuspicious: boolean;
    riskScore: number;
    reasons: string[];
    blockedReason: string | null;
  }> {
    await this.ensureComplianceSchema();
    const policy = await this.getPolicy();
    const dd = policy.duplicateDetection;
    const normalizedEmail = normalizeEmailAddress(params.email);

    if (dd.blockDisposableEmailDomains && isDisposableEmail(params.email)) {
      return {
        normalizedEmail,
        isSuspicious: true,
        riskScore: 95,
        reasons: ['Disposable / temporary email provider detected'],
        blockedReason: 'Disposable or temporary email addresses are not permitted for registration.',
      };
    }

    const reasons: string[] = [];
    let riskScore = 0;

    if (dd.checkNormalizedEmail) {
      const sameNorm = await prisma.user.findFirst({
        where: { normalizedEmail },
        select: { id: true, email: true },
      });
      if (sameNorm) {
        reasons.push(`Normalized email alias matches existing account (${sameNorm.email})`);
        riskScore += 55;
      }
    }

    const cleanPhoneDigits = (params.phone || '').replace(/\D/g, '');
    if (dd.checkPhone && cleanPhoneDigits.length >= 7) {
      const phoneMatches = await prisma.user.findMany({
        where: { phone: { contains: cleanPhoneDigits.slice(-7) } },
        select: { id: true, phone: true, email: true },
        take: 10,
      });
      const exactMatch = phoneMatches.find(
        (u) => (u.phone || '').replace(/\D/g, '') === cleanPhoneDigits
      );
      if (exactMatch) {
        reasons.push(`Duplicate phone number already registered (${exactMatch.email})`);
        riskScore += 50;
      }
    }

    if (dd.checkSignupIp && params.signupIp) {
      const ipCount = await prisma.user.count({
        where: { signupIp: params.signupIp },
      });
      if (ipCount >= (dd.maxAccountsPerIp || 3)) {
        reasons.push(`Multiple accounts (${ipCount + 1}) registered from IP ${params.signupIp}`);
        riskScore += 35;
      }
    }

    if (dd.checkDeviceFingerprint && params.deviceFingerprint) {
      const fpMatches = await prisma.user.count({
        where: { deviceFingerprint: params.deviceFingerprint },
      });
      if (fpMatches >= 2) {
        reasons.push(`Device fingerprint shared with ${fpMatches} existing account(s)`);
        riskScore += 35;
      }
    }

    const isSuspicious = reasons.length > 0;
    const blockedReason =
      isSuspicious && dd.actionOnDuplicate === 'BLOCK_REGISTRATION' && riskScore >= 50
        ? `Registration blocked by anti-spam duplicate policy: ${reasons[0]}`
        : null;

    return {
      normalizedEmail,
      isSuspicious,
      riskScore: Math.min(100, riskScore),
      reasons,
      blockedReason,
    };
  }

  /**
   * Detect duplicate KYC Document ID Number across different accounts
   */
  async evaluateKycDocumentDuplicates(params: {
    userId: string;
    idNumber?: string;
    documentType: string;
    issuingCountry?: string;
  }): Promise<{ duplicateFound: boolean; matchedEmails: string[] }> {
    await this.ensureComplianceSchema();
    const policy = await this.getPolicy();
    if (!policy.duplicateDetection.checkKycIdNumber) {
      return { duplicateFound: false, matchedEmails: [] };
    }
    const cleanId = (params.idNumber || '').trim().toUpperCase();
    if (!cleanId || cleanId.length < 4) {
      return { duplicateFound: false, matchedEmails: [] };
    }

    const matches = await prisma.kycDocument.findMany({
      where: {
        userId: { not: params.userId },
        idNumber: cleanId,
        documentType: params.documentType,
      },
      include: {
        user: { select: { id: true, email: true } },
      },
      take: 10,
    });

    if (matches.length === 0) {
      return { duplicateFound: false, matchedEmails: [] };
    }

    const matchedEmails = Array.from(new Set(matches.map((m) => m.user.email)));
    const reason = `Duplicate KYC document ${params.documentType} #${cleanId} detected across accounts: ${matchedEmails.join(', ')}`;

    await prisma.user
      .update({
        where: { id: params.userId },
        data: {
          isSuspicious: true,
          suspiciousReason: reason,
          flaggedAt: new Date(),
          flaggedBy: 'ANTI_SPAM_ENGINE',
          riskScore: 85,
        },
      })
      .catch(() => {});

    notificationService
      .sendAdminAlert(
        `Duplicate KYC Identity Document Flagged`,
        `${reason}\nReview immediately in Admin → KYC Compliance.`,
        { userId: params.userId, matchedEmails, documentType: params.documentType }
      )
      .catch(() => {});

    return { duplicateFound: true, matchedEmails };
  }

  /**
   * Estimate USD value of a request payload for New User transaction limit enforcement
   */
  extractRequestUsdEstimate(reqBody: any): number | null {
    if (!reqBody) return null;
    const rawAmt = Number(reqBody.amount ?? reqBody.fromAmount ?? reqBody.cryptoAmount ?? reqBody.fiatAmount);
    if (!Number.isFinite(rawAmt) || rawAmt <= 0) return null;
    const cur = String(reqBody.currency || reqBody.fromCurrency || reqBody.sourceCurrency || 'USD').toUpperCase();
    if (['USD', 'USDT', 'USDC'].includes(cur)) return rawAmt;
    if (cur === 'BTC') return rawAmt * 95000;
    if (cur === 'ETH') return rawAmt * 3200;
    if (cur === 'EUR' || cur === 'GBP') return rawAmt * 1.15;
    if (cur === 'AED') return rawAmt / 3.67;
    if (cur === 'GEL') return rawAmt / 2.75;
    if (cur === 'INR') return rawAmt / 84;
    if (cur === 'LKR') return rawAmt / 300;
    return rawAmt;
  }

  /**
   * Enforces Email Verification, Configurable KYC Feature Gates, and New-User Velocity Limits
   * at the backend API level.
   */
  async assertUserEligibleForFeature(params: {
    userId: string;
    featureKey: string;
    amountUsd?: number | null;
  }): Promise<void> {
    await this.ensureComplianceSchema();
    const policy = await this.getPolicy();

    const user = await prisma.user.findUnique({
      where: { id: params.userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        emailVerified: true,
        kycStatus: true,
        kycExpiresAt: true,
        isSuspicious: true,
        bypassNewUserLimits: true,
        createdAt: true,
      },
    });

    if (!user) {
      const err: any = new Error('User account not found.');
      err.status = 401;
      throw err;
    }

    if (user.status !== UserStatus.ACTIVE) {
      const err: any = new Error('Your account is currently suspended or locked. Please contact compliance support.');
      err.status = 403;
      err.code = 'ACCOUNT_SUSPENDED';
      throw err;
    }

    // Admins, Staff, and configured institutional treasury desks bypass customer onboarding gates
    if (
      user.role === Role.ADMIN ||
      user.role === Role.STAFF ||
      INSTITUTIONAL_EXEMPT_EMAILS.has(user.email.toLowerCase())
    ) {
      return;
    }

    // 1. Check Email Verification Requirement
    if (
      policy.emailVerification.requireEmailVerificationForSensitiveActions &&
      !user.emailVerified
    ) {
      const err: any = new Error(
        'Email verification is required before using financial features. Please verify your email address from your Dashboard or verification link.'
      );
      err.status = 403;
      err.code = 'EMAIL_VERIFICATION_REQUIRED';
      throw err;
    }

    // 2. Auto-expire KYC if kycExpiresAt has passed
    let effectiveKycStatus: KycStatus = user.kycStatus;
    if (effectiveKycStatus === KycStatus.APPROVED && user.kycExpiresAt && new Date() > user.kycExpiresAt) {
      effectiveKycStatus = KycStatus.EXPIRED;
      await prisma.user
        .update({
          where: { id: user.id },
          data: { kycStatus: KycStatus.EXPIRED },
        })
        .catch(() => {});
    }

    // 3. Enforce Admin-Configurable KYC Requirement per Feature
    const reqFeatures = policy.kycRequiredFeatures as Record<string, boolean>;
    const requiresKyc = reqFeatures[params.featureKey] === true;
    if (requiresKyc && effectiveKycStatus !== KycStatus.APPROVED) {
      const humanLabel = KYC_STATUS_LABELS[effectiveKycStatus] || effectiveKycStatus;
      const err: any = new Error(
        `Verified KYC is required to access ${params.featureKey.replace(/_/g, ' ')}. Current KYC status: ${humanLabel}. Please submit or complete KYC verification in your Dashboard.`
      );
      err.status = 403;
      err.code = 'KYC_REQUIRED';
      err.kycStatus = effectiveKycStatus;
      err.featureKey = params.featureKey;
      throw err;
    }

    // 4. Enforce Configurable New-User Action Limits
    if (policy.newUserLimits.enabled && !user.bypassNewUserLimits) {
      const accountAgeHours = (Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60);
      if (accountAgeHours < policy.newUserLimits.windowHours) {
        const remainingHours = Math.max(1, Math.ceil(policy.newUserLimits.windowHours - accountAgeHours));

        if (params.featureKey === 'WITHDRAWALS' && policy.newUserLimits.blockWithdrawalsDuringWindow) {
          const err: any = new Error(
            `New-account security cooldown: withdrawals are restricted during your first ${policy.newUserLimits.windowHours} hours (${remainingHours}h remaining).`
          );
          err.status = 403;
          err.code = 'NEW_USER_LIMIT';
          throw err;
        }

        if (
          typeof params.amountUsd === 'number' &&
          params.amountUsd > 0 &&
          params.amountUsd > policy.newUserLimits.maxSingleTxUsd
        ) {
          const err: any = new Error(
            `New-account single transaction limit ($${policy.newUserLimits.maxSingleTxUsd.toFixed(2)} USD max during first ${policy.newUserLimits.windowHours}h) exceeded.`
          );
          err.status = 403;
          err.code = 'NEW_USER_LIMIT';
          throw err;
        }

        if (typeof params.amountUsd === 'number' && params.amountUsd > 0) {
          const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
          const recentTxs = await prisma.transaction.findMany({
            where: {
              userId: user.id,
              createdAt: { gte: since24h },
              currency: { in: ['USD', 'USDT', 'USDC'] },
              type: {
                in: [
                  'PACKAGE_PURCHASE',
                  'P2P_TRANSFER_OUT',
                  'GLOBAL_TRANSFER_OUT',
                  'INVESTMENT_ALLOCATION',
                  'WITHDRAWAL_REQUEST',
                  'EXCHANGE_BUY',
                  'EXCHANGE_SELL',
                ],
              },
            },
            select: { amount: true },
          });
          const spent24h = recentTxs.reduce(
            (sum, tx) => sum + Number(new Decimal(tx.amount.toString()).toFixed(2)),
            0
          );
          if (spent24h + params.amountUsd > policy.newUserLimits.maxDailyTotalUsd) {
            const err: any = new Error(
              `New-account 24h cumulative limit ($${policy.newUserLimits.maxDailyTotalUsd.toFixed(2)} USD max during first ${policy.newUserLimits.windowHours}h) reached.`
            );
            err.status = 403;
            err.code = 'NEW_USER_LIMIT';
            throw err;
          }
        }
      }
    }
  }
}

export const compliancePolicyService = new CompliancePolicyService();
