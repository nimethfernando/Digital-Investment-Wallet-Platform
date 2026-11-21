"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ventureMatchmakingService = exports.VentureMatchmakingService = void 0;
const prisma_1 = require("../lib/prisma");
const decimal_js_1 = __importDefault(require("decimal.js"));
const notification_provider_1 = require("../adapters/notification/notification.provider");
class VentureMatchmakingService {
    schemaReady = false;
    async ensureSchema() {
        if (this.schemaReady)
            return;
        try {
            await prisma_1.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS diw_venture_opportunities (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          opportunityCode VARCHAR(32) NOT NULL UNIQUE,
          userId VARCHAR(36) NOT NULL,
          title VARCHAR(255) NOT NULL,
          description TEXT NOT NULL,
          intent VARCHAR(32) NOT NULL,
          dealType VARCHAR(32) NOT NULL,
          targetAmount DECIMAL(20, 2) NOT NULL,
          minAmount DECIMAL(20, 2) NULL,
          maxAmount DECIMAL(20, 2) NULL,
          currency VARCHAR(10) NOT NULL DEFAULT 'USD',
          preferredTerms TEXT NULL,
          expectedInterestRate DECIMAL(8, 2) NULL,
          tenureMonths INT NULL,
          industry VARCHAR(100) NOT NULL,
          stage VARCHAR(50) NULL,
          locationCountry VARCHAR(100) NULL,
          locationCountryCode VARCHAR(10) NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
          applicantCount INT NOT NULL DEFAULT 0,
          contactEmail VARCHAR(255) NULL,
          contactPhone VARCHAR(50) NULL,
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_opp_intent_type (intent, dealType),
          INDEX idx_opp_status (status),
          INDEX idx_opp_user (userId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
            await prisma_1.prisma.$executeRawUnsafe(`
        CREATE TABLE IF NOT EXISTS diw_opportunity_applications (
          id VARCHAR(36) NOT NULL PRIMARY KEY,
          applicationCode VARCHAR(32) NOT NULL UNIQUE,
          opportunityId VARCHAR(36) NOT NULL,
          applicantUserId VARCHAR(36) NOT NULL,
          applicantRole VARCHAR(32) NOT NULL,
          proposedAmount DECIMAL(20, 2) NOT NULL,
          proposedTerms TEXT NULL,
          applicantNote TEXT NOT NULL,
          pitchDeckUrl VARCHAR(500) NULL,
          status VARCHAR(32) NOT NULL DEFAULT 'PENDING_REVIEW',
          adminNotes TEXT NULL,
          connectedAt DATETIME NULL,
          connectedByAdminId VARCHAR(36) NULL,
          createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
          INDEX idx_app_opp (opportunityId),
          INDEX idx_app_user (applicantUserId),
          INDEX idx_app_status (status),
          UNIQUE KEY unq_user_opp (applicantUserId, opportunityId)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
            this.schemaReady = true;
        }
        catch (err) {
            console.warn('[VentureMatchmakingService] ensureSchema warning:', err?.message || err);
        }
    }
    /**
     * List active dealflow opportunities with search & filters
     */
    async listOpportunities(params) {
        await this.ensureSchema();
        const conditions = [];
        const values = [];
        if (params?.status && params.status !== 'ALL') {
            conditions.push('o.status = ?');
            values.push(params.status);
        }
        else if (!params?.userId) {
            // Default to ACTIVE for public browse
            conditions.push("o.status = 'ACTIVE'");
        }
        if (params?.intent && params.intent !== 'ALL') {
            conditions.push('o.intent = ?');
            values.push(params.intent);
        }
        if (params?.dealType && params.dealType !== 'ALL') {
            conditions.push('o.dealType = ?');
            values.push(params.dealType);
        }
        if (params?.industry && params.industry !== 'ALL') {
            conditions.push('o.industry = ?');
            values.push(params.industry);
        }
        if (params?.userId) {
            conditions.push('o.userId = ?');
            values.push(params.userId);
        }
        if (params?.search && params.search.trim()) {
            const q = `%${params.search.trim()}%`;
            conditions.push('(o.title LIKE ? OR o.description LIKE ? OR o.industry LIKE ? OR o.preferredTerms LIKE ?)');
            values.push(q, q, q, q);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `
      SELECT 
        o.*,
        u.email as creatorEmail,
        u.firstName as creatorFirstName,
        u.lastName as creatorLastName,
        u.country as creatorCountry,
        u.kycStatus as creatorKycStatus
      FROM diw_venture_opportunities o
      LEFT JOIN diw_users u ON o.userId = u.id
      ${whereClause}
      ORDER BY o.createdAt DESC
      LIMIT 100;
    `;
        const rawRows = (await prisma_1.prisma.$queryRawUnsafe(sql, ...values));
        return rawRows.map((r) => this.formatOpportunityRow(r));
    }
    /**
     * Get single opportunity by ID
     */
    async getOpportunityById(id, viewerUserId) {
        await this.ensureSchema();
        const rows = (await prisma_1.prisma.$queryRawUnsafe(`
      SELECT 
        o.*,
        u.email as creatorEmail,
        u.firstName as creatorFirstName,
        u.lastName as creatorLastName,
        u.country as creatorCountry,
        u.kycStatus as creatorKycStatus
      FROM diw_venture_opportunities o
      LEFT JOIN diw_users u ON o.userId = u.id
      WHERE o.id = ? OR o.opportunityCode = ?
      LIMIT 1;
    `, id, id));
        if (!rows || rows.length === 0) {
            throw new Error('Dealflow opportunity not found.');
        }
        const opp = this.formatOpportunityRow(rows[0]);
        let userApplication = null;
        if (viewerUserId) {
            const appRows = (await prisma_1.prisma.$queryRawUnsafe(`SELECT * FROM diw_opportunity_applications WHERE opportunityId = ? AND applicantUserId = ? LIMIT 1`, opp.id, viewerUserId));
            if (appRows && appRows.length > 0) {
                userApplication = this.formatApplicationRow(appRows[0]);
            }
        }
        return { ...opp, userApplication };
    }
    /**
     * Create a new dealflow opportunity post (Registered users only)
     */
    async createOpportunity(userId, data) {
        await this.ensureSchema();
        // Verify user exists
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, firstName: true, lastName: true, country: true },
        });
        if (!user)
            throw new Error('Unauthorized. Registered account required.');
        const title = (data.title || '').trim();
        if (!title || title.length < 5) {
            throw new Error('Title must be at least 5 characters long.');
        }
        const description = (data.description || '').trim();
        if (!description || description.length < 20) {
            throw new Error('Please provide a detailed description (at least 20 characters).');
        }
        const targetAmount = new decimal_js_1.default(data.targetAmount || 0);
        if (!targetAmount.isFinite() || targetAmount.lessThanOrEqualTo(0)) {
            throw new Error('Target funding/investment amount must be greater than zero.');
        }
        const minAmount = data.minAmount ? new decimal_js_1.default(data.minAmount) : null;
        const maxAmount = data.maxAmount ? new decimal_js_1.default(data.maxAmount) : null;
        const expectedInterestRate = data.expectedInterestRate ? new decimal_js_1.default(data.expectedInterestRate) : null;
        const tenureMonths = data.tenureMonths ? parseInt(data.tenureMonths.toString(), 10) : null;
        const oppId = `opp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const oppCode = `OPP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        await prisma_1.prisma.$executeRawUnsafe(`
      INSERT INTO diw_venture_opportunities (
        id, opportunityCode, userId, title, description, intent, dealType,
        targetAmount, minAmount, maxAmount, currency, preferredTerms,
        expectedInterestRate, tenureMonths, industry, stage, locationCountry,
        locationCountryCode, status, contactEmail, contactPhone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, oppId, oppCode, userId, title, description, data.intent, data.dealType, targetAmount.toFixed(2), minAmount ? minAmount.toFixed(2) : null, maxAmount ? maxAmount.toFixed(2) : null, (data.currency || 'USD').toUpperCase(), data.preferredTerms || null, expectedInterestRate ? expectedInterestRate.toFixed(2) : null, tenureMonths, data.industry || 'General', data.stage || null, data.locationCountry || user.country || 'Global', data.locationCountryCode || null, 'ACTIVE', data.contactEmail || user.email, data.contactPhone || null);
        // Notify Admin of new opportunity
        notification_provider_1.notificationService
            .sendAdminAlert(`[Dealflow] New Opportunity: ${title}`, `New dealflow opportunity posted by ${user.email}: ${title} (${data.intent} - ${data.dealType}, Target: $${targetAmount.toFixed(2)} USD)`, {
            opportunityCode: oppCode,
            title,
            intent: data.intent,
            dealType: data.dealType,
            targetAmount: `$${targetAmount.toFixed(2)} USD`,
            creatorEmail: user.email,
            creatorName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        })
            .catch(() => { });
        return this.getOpportunityById(oppId, userId);
    }
    /**
     * Apply / Express Interest in an Opportunity (Registered users only)
     */
    async applyToOpportunity(userId, opportunityId, data) {
        await this.ensureSchema();
        // Verify applicant is a registered platform user
        const applicant = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                phone: true,
                country: true,
                kycStatus: true,
                createdAt: true,
            },
        });
        if (!applicant) {
            throw new Error('Only registered users on Avora Bank can apply to dealflow opportunities.');
        }
        // Verify opportunity exists and is active
        const oppRows = (await prisma_1.prisma.$queryRawUnsafe(`SELECT * FROM diw_venture_opportunities WHERE id = ? LIMIT 1`, opportunityId));
        if (!oppRows || oppRows.length === 0) {
            throw new Error('Opportunity not found.');
        }
        const opp = oppRows[0];
        if (opp.status !== 'ACTIVE') {
            throw new Error(`This opportunity is currently ${opp.status} and not accepting applications.`);
        }
        // Prevent creator from applying to their own opportunity
        if (opp.userId === userId) {
            throw new Error('You cannot apply to your own opportunity post.');
        }
        // Check duplicate application
        const existing = (await prisma_1.prisma.$queryRawUnsafe(`SELECT id FROM diw_opportunity_applications WHERE opportunityId = ? AND applicantUserId = ? LIMIT 1`, opportunityId, userId));
        if (existing && existing.length > 0) {
            throw new Error('You have already submitted an application for this opportunity.');
        }
        const note = (data.applicantNote || '').trim();
        if (!note || note.length < 15) {
            throw new Error('Please include a detailed note (at least 15 characters) explaining your profile and requirements.');
        }
        const proposedAmount = new decimal_js_1.default(data.proposedAmount || opp.targetAmount);
        if (!proposedAmount.isFinite() || proposedAmount.lessThanOrEqualTo(0)) {
            throw new Error('Proposed amount must be greater than zero.');
        }
        const appId = `app_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const appCode = `APP-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
        await prisma_1.prisma.$executeRawUnsafe(`
      INSERT INTO diw_opportunity_applications (
        id, applicationCode, opportunityId, applicantUserId, applicantRole,
        proposedAmount, proposedTerms, applicantNote, pitchDeckUrl, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, appId, appCode, opportunityId, userId, data.applicantRole || (opp.intent === 'OFFERING_CAPITAL' ? 'STARTUP_FOUNDER' : 'INVESTOR'), proposedAmount.toFixed(2), data.proposedTerms || null, note, data.pitchDeckUrl || null, 'PENDING_REVIEW');
        // Increment applicant count on opportunity
        await prisma_1.prisma.$executeRawUnsafe(`UPDATE diw_venture_opportunities SET applicantCount = applicantCount + 1 WHERE id = ?`, opportunityId);
        // Notify Admin of new application to collect & filter
        notification_provider_1.notificationService
            .sendAdminAlert(`[Dealflow] New Application for ${opp.title}`, `Registered applicant ${applicant.email} applied for ${opp.title} (${opp.opportunityCode}) with proposed amount $${proposedAmount.toFixed(2)} USD. Note: ${note.slice(0, 150)}`, {
            applicationCode: appCode,
            opportunityTitle: opp.title,
            opportunityCode: opp.opportunityCode,
            applicantEmail: applicant.email,
            applicantName: `${applicant.firstName || ''} ${applicant.lastName || ''}`.trim() || applicant.email,
            applicantKyc: applicant.kycStatus,
            proposedAmount: `$${proposedAmount.toFixed(2)} USD`,
            noteSnippet: note.slice(0, 150),
        })
            .catch(() => { });
        return {
            id: appId,
            applicationCode: appCode,
            opportunityId,
            applicantUserId: userId,
            status: 'PENDING_REVIEW',
            proposedAmount: proposedAmount.toFixed(2),
            message: 'Your application has been received and submitted to the Dealflow Curation Desk.',
        };
    }
    /**
     * Get user's own applications
     */
    async getMyApplications(userId) {
        await this.ensureSchema();
        const rows = (await prisma_1.prisma.$queryRawUnsafe(`
      SELECT 
        a.*,
        o.opportunityCode,
        o.title as opportunityTitle,
        o.intent as opportunityIntent,
        o.dealType as opportunityDealType,
        o.targetAmount as opportunityTargetAmount,
        o.currency as opportunityCurrency,
        o.industry as opportunityIndustry,
        o.stage as opportunityStage,
        o.status as opportunityStatus
      FROM diw_opportunity_applications a
      JOIN diw_venture_opportunities o ON a.opportunityId = o.id
      WHERE a.applicantUserId = ?
      ORDER BY a.createdAt DESC;
    `, userId));
        return rows.map((r) => this.formatApplicationRow(r));
    }
    /**
     * ADMIN: List all applications across opportunities with deep filtering
     */
    async adminListApplications(filters) {
        await this.ensureSchema();
        const conditions = [];
        const values = [];
        if (filters?.opportunityId && filters.opportunityId !== 'ALL') {
            conditions.push('a.opportunityId = ?');
            values.push(filters.opportunityId);
        }
        if (filters?.status && filters.status !== 'ALL') {
            conditions.push('a.status = ?');
            values.push(filters.status);
        }
        if (filters?.dealType && filters.dealType !== 'ALL') {
            conditions.push('o.dealType = ?');
            values.push(filters.dealType);
        }
        if (filters?.intent && filters.intent !== 'ALL') {
            conditions.push('o.intent = ?');
            values.push(filters.intent);
        }
        if (filters?.search && filters.search.trim()) {
            const q = `%${filters.search.trim()}%`;
            conditions.push('(o.title LIKE ? OR a.applicantNote LIKE ? OR a.applicationCode LIKE ? OR u.email LIKE ? OR u.firstName LIKE ? OR u.lastName LIKE ?)');
            values.push(q, q, q, q, q, q);
        }
        const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
        const sql = `
      SELECT 
        a.*,
        o.opportunityCode,
        o.title as opportunityTitle,
        o.intent as opportunityIntent,
        o.dealType as opportunityDealType,
        o.targetAmount as opportunityTargetAmount,
        o.currency as opportunityCurrency,
        o.industry as opportunityIndustry,
        o.stage as opportunityStage,
        o.preferredTerms as opportunityTerms,
        o.userId as opportunityCreatorUserId,
        creator.email as creatorEmail,
        creator.firstName as creatorFirstName,
        creator.lastName as creatorLastName,
        u.email as applicantEmail,
        u.firstName as applicantFirstName,
        u.lastName as applicantLastName,
        u.phone as applicantPhone,
        u.country as applicantCountry,
        u.kycStatus as applicantKycStatus,
        u.createdAt as applicantJoinedAt
      FROM diw_opportunity_applications a
      JOIN diw_venture_opportunities o ON a.opportunityId = o.id
      JOIN diw_users u ON a.applicantUserId = u.id
      LEFT JOIN diw_users creator ON o.userId = creator.id
      ${whereClause}
      ORDER BY a.createdAt DESC;
    `;
        const rows = (await prisma_1.prisma.$queryRawUnsafe(sql, ...values));
        return rows.map((r) => this.formatApplicationRow(r));
    }
    /**
     * ADMIN: Update Application Status & Facilitate Connection
     */
    async adminUpdateApplicationStatus(applicationId, adminId, data) {
        await this.ensureSchema();
        const appRows = (await prisma_1.prisma.$queryRawUnsafe(`
      SELECT 
        a.*,
        o.title as opportunityTitle,
        o.opportunityCode,
        o.userId as creatorUserId,
        creator.email as creatorEmail,
        creator.firstName as creatorFirstName,
        u.email as applicantEmail,
        u.firstName as applicantFirstName
      FROM diw_opportunity_applications a
      JOIN diw_venture_opportunities o ON a.opportunityId = o.id
      JOIN diw_users u ON a.applicantUserId = u.id
      LEFT JOIN diw_users creator ON o.userId = creator.id
      WHERE a.id = ? LIMIT 1;
    `, applicationId));
        if (!appRows || appRows.length === 0) {
            throw new Error('Application not found.');
        }
        const app = appRows[0];
        const connectedAt = data.status === 'CONNECTED' ? new Date() : app.connectedAt;
        const connectedByAdminId = data.status === 'CONNECTED' ? adminId : app.connectedByAdminId;
        await prisma_1.prisma.$executeRawUnsafe(`
      UPDATE diw_opportunity_applications 
      SET status = ?, adminNotes = ?, connectedAt = ?, connectedByAdminId = ?
      WHERE id = ?
    `, data.status, data.adminNotes !== undefined ? data.adminNotes : app.adminNotes, connectedAt, connectedByAdminId, applicationId);
        // If marked CONNECTED, notify both parties!
        if (data.status === 'CONNECTED') {
            // Notify Applicant
            notification_provider_1.notificationService
                .sendEmail({
                to: app.applicantEmail,
                subject: `Avora Dealflow Connection: ${app.opportunityTitle}`,
                html: `
            <h3>Dealflow Match Established!</h3>
            <p>Hello ${app.applicantFirstName || 'Member'},</p>
            <p>Our Venture & Capital Desk has reviewed your application for <strong>${app.opportunityTitle}</strong> (${app.opportunityCode}) and connected your profile with the opportunity sponsor.</p>
            <p><strong>Desk Facilitation Note:</strong> ${data.connectionNotes || data.adminNotes || 'Sponsor details have been shared for direct coordination.'}</p>
            <p>Our team will follow up directly to assist with due diligence, legal documentation, and secure settlement.</p>
          `,
            })
                .catch(() => { });
            // Notify Opportunity Creator
            if (app.creatorEmail) {
                notification_provider_1.notificationService
                    .sendEmail({
                    to: app.creatorEmail,
                    subject: `Relevant Applicant Connected for Your Post: ${app.opportunityTitle}`,
                    html: `
              <h3>Relevant Match Connected!</h3>
              <p>Hello ${app.creatorFirstName || 'Member'},</p>
              <p>Avora Bank Dealflow Curation has matched a qualified registered applicant for your posting: <strong>${app.opportunityTitle}</strong>.</p>
              <p><strong>Applicant:</strong> ${app.applicantFirstName} (${app.applicantEmail})</p>
              <p><strong>Proposed Amount:</strong> $${app.proposedAmount} USD</p>
              <p><strong>Desk Note:</strong> ${data.connectionNotes || data.adminNotes || 'Match approved.'}</p>
            `,
                })
                    .catch(() => { });
            }
        }
        return {
            success: true,
            applicationId,
            status: data.status,
            connectedAt,
            message: data.status === 'CONNECTED'
                ? 'Application marked as CONNECTED. Both parties notified.'
                : `Application status updated to ${data.status}.`,
        };
    }
    /**
     * ADMIN: Update Opportunity Status
     */
    async adminUpdateOpportunityStatus(opportunityId, adminId, data) {
        await this.ensureSchema();
        await prisma_1.prisma.$executeRawUnsafe(`UPDATE diw_venture_opportunities SET status = ? WHERE id = ?`, data.status, opportunityId);
        return { success: true, opportunityId, status: data.status };
    }
    /**
     * Helper formatting
     */
    formatOpportunityRow(r) {
        return {
            id: r.id,
            opportunityCode: r.opportunityCode,
            userId: r.userId,
            title: r.title,
            description: r.description,
            intent: r.intent,
            dealType: r.dealType,
            targetAmount: Number(r.targetAmount || 0),
            minAmount: r.minAmount ? Number(r.minAmount) : null,
            maxAmount: r.maxAmount ? Number(r.maxAmount) : null,
            currency: r.currency || 'USD',
            preferredTerms: r.preferredTerms || null,
            expectedInterestRate: r.expectedInterestRate ? Number(r.expectedInterestRate) : null,
            tenureMonths: r.tenureMonths ? Number(r.tenureMonths) : null,
            industry: r.industry,
            stage: r.stage || null,
            locationCountry: r.locationCountry || 'Global',
            locationCountryCode: r.locationCountryCode || null,
            status: r.status,
            applicantCount: Number(r.applicantCount || 0),
            contactEmail: r.contactEmail || null,
            contactPhone: r.contactPhone || null,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            creator: {
                email: r.creatorEmail || 'Confidential Member',
                firstName: r.creatorFirstName || '',
                lastName: r.creatorLastName || '',
                country: r.creatorCountry || '',
                kycStatus: r.creatorKycStatus || 'UNVERIFIED',
            },
        };
    }
    formatApplicationRow(r) {
        return {
            id: r.id,
            applicationCode: r.applicationCode,
            opportunityId: r.opportunityId,
            applicantUserId: r.applicantUserId,
            applicantRole: r.applicantRole,
            proposedAmount: Number(r.proposedAmount || 0),
            proposedTerms: r.proposedTerms || null,
            applicantNote: r.applicantNote,
            pitchDeckUrl: r.pitchDeckUrl || null,
            status: r.status,
            adminNotes: r.adminNotes || null,
            connectedAt: r.connectedAt || null,
            connectedByAdminId: r.connectedByAdminId || null,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
            opportunity: r.opportunityTitle
                ? {
                    code: r.opportunityCode,
                    title: r.opportunityTitle,
                    intent: r.opportunityIntent,
                    dealType: r.opportunityDealType,
                    targetAmount: Number(r.opportunityTargetAmount || 0),
                    currency: r.opportunityCurrency || 'USD',
                    industry: r.opportunityIndustry,
                    stage: r.opportunityStage,
                    terms: r.opportunityTerms,
                    creatorEmail: r.creatorEmail,
                    creatorName: `${r.creatorFirstName || ''} ${r.creatorLastName || ''}`.trim() || r.creatorEmail,
                }
                : undefined,
            applicant: r.applicantEmail
                ? {
                    id: r.applicantUserId,
                    email: r.applicantEmail,
                    name: `${r.applicantFirstName || ''} ${r.applicantLastName || ''}`.trim() || r.applicantEmail,
                    phone: r.applicantPhone || '',
                    country: r.applicantCountry || '',
                    kycStatus: r.applicantKycStatus || 'UNVERIFIED',
                    joinedAt: r.applicantJoinedAt,
                }
                : undefined,
        };
    }
}
exports.VentureMatchmakingService = VentureMatchmakingService;
exports.ventureMatchmakingService = new VentureMatchmakingService();
