"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ventureMatchmakingController = exports.VentureMatchmakingController = void 0;
const ventureMatchmaking_service_1 = require("../services/ventureMatchmaking.service");
class VentureMatchmakingController {
    /**
     * GET /api/v1/investments/dealflow/opportunities
     * List dealflow opportunities with search & filters
     */
    async listOpportunities(req, res, next) {
        try {
            const { intent, dealType, industry, search, status } = req.query;
            const list = await ventureMatchmaking_service_1.ventureMatchmakingService.listOpportunities({
                intent,
                dealType,
                industry,
                search,
                status,
            });
            res.json({ success: true, count: list.length, data: list });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/investments/dealflow/opportunities/:id
     * Get single opportunity detail
     */
    async getOpportunity(req, res, next) {
        try {
            const viewerUserId = req.user?.id || req.user?.userId;
            const opp = await ventureMatchmaking_service_1.ventureMatchmakingService.getOpportunityById(String(req.params.id), viewerUserId);
            res.json({ success: true, data: opp });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/investments/dealflow/opportunities
     * Create a new dealflow opportunity post (Registered users only)
     */
    async createOpportunity(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Authentication required.' });
            }
            const opp = await ventureMatchmaking_service_1.ventureMatchmakingService.createOpportunity(userId, req.body);
            res.status(201).json({
                success: true,
                message: 'Opportunity posted successfully! It is now live in the dealflow directory.',
                data: opp,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/investments/dealflow/opportunities/:id/apply
     * Apply / Express Interest in an opportunity (Registered users only)
     */
    async applyToOpportunity(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            if (!userId) {
                return res.status(401).json({
                    success: false,
                    message: 'Only registered users on Avora Bank can apply to opportunities.',
                });
            }
            const result = await ventureMatchmaking_service_1.ventureMatchmakingService.applyToOpportunity(userId, String(req.params.id), req.body);
            res.status(201).json({
                success: true,
                message: result.message,
                data: result,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/investments/dealflow/my-posts
     * List opportunities posted by current user
     */
    async getMyOpportunities(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Authentication required.' });
            }
            const list = await ventureMatchmaking_service_1.ventureMatchmakingService.listOpportunities({ userId, status: 'ALL' });
            res.json({ success: true, count: list.length, data: list });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/investments/dealflow/my-applications
     * List applications submitted by current user
     */
    async getMyApplications(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            if (!userId) {
                return res.status(401).json({ success: false, message: 'Authentication required.' });
            }
            const list = await ventureMatchmaking_service_1.ventureMatchmakingService.getMyApplications(userId);
            res.json({ success: true, count: list.length, data: list });
        }
        catch (err) {
            next(err);
        }
    }
    // =========================================================================
    // ADMIN MATCHMAKING & CURATION DESK
    // =========================================================================
    /**
     * GET /api/v1/admin/dealflow/opportunities
     */
    async adminListOpportunities(req, res, next) {
        try {
            const { intent, dealType, status, search } = req.query;
            const list = await ventureMatchmaking_service_1.ventureMatchmakingService.listOpportunities({
                intent,
                dealType,
                status: status || 'ALL',
                search,
            });
            res.json({ success: true, count: list.length, data: list });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/admin/dealflow/applications
     */
    async adminListApplications(req, res, next) {
        try {
            const { opportunityId, status, dealType, intent, search } = req.query;
            const list = await ventureMatchmaking_service_1.ventureMatchmakingService.adminListApplications({
                opportunityId,
                status,
                dealType,
                intent,
                search,
            });
            res.json({ success: true, count: list.length, data: list });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * PATCH /api/v1/admin/dealflow/applications/:id
     * Facilitate connection / shortlist / decline application
     */
    async adminUpdateApplicationStatus(req, res, next) {
        try {
            const adminId = req.user?.id || req.user?.userId || 'admin';
            const result = await ventureMatchmaking_service_1.ventureMatchmakingService.adminUpdateApplicationStatus(String(req.params.id), adminId, req.body);
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * PATCH /api/v1/admin/dealflow/opportunities/:id
     */
    async adminUpdateOpportunityStatus(req, res, next) {
        try {
            const adminId = req.user?.id || req.user?.userId || 'admin';
            const result = await ventureMatchmaking_service_1.ventureMatchmakingService.adminUpdateOpportunityStatus(String(req.params.id), adminId, req.body);
            res.json(result);
        }
        catch (err) {
            next(err);
        }
    }
}
exports.VentureMatchmakingController = VentureMatchmakingController;
exports.ventureMatchmakingController = new VentureMatchmakingController();
