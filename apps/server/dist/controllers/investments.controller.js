"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.investmentsController = exports.InvestmentsController = void 0;
const investments_service_1 = require("../services/investments.service");
class InvestmentsController {
    /**
     * GET /api/v1/investments/campaigns
     * Public: List all published startup funding opportunities
     */
    async listCampaigns(req, res, next) {
        try {
            const { industry, countryCode, stage, instrument, search } = req.query;
            const [campaigns, filterOptions] = await Promise.all([
                investments_service_1.investmentsService.listCampaigns({
                    industry,
                    countryCode,
                    stage,
                    instrument,
                    search,
                }),
                investments_service_1.investmentsService.listPublishedFilterOptions(),
            ]);
            res.json({
                success: true,
                data: campaigns,
                categories: filterOptions.categories,
                instruments: filterOptions.instruments,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/investments/campaigns/:slug
     * Public/Protected: Get detailed campaign profile
     */
    async getCampaign(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : String(req.params.slug);
            const campaign = await investments_service_1.investmentsService.getCampaignBySlug(slug, userId);
            res.json({ success: true, data: campaign });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/investments/fee-quote
     * Calculate dynamic investment allocation fee breakdown
     */
    async calculateFee(req, res, next) {
        try {
            const { grossAmount } = req.body;
            const breakdown = await investments_service_1.investmentsService.calculateInvestmentFee(parseFloat(grossAmount));
            res.json({ success: true, data: breakdown });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/investments/invest
     * Commit and fund investment from wallet (with dynamic allocation fee)
     */
    async invest(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const { listingId, grossAmount, instrument, notes, riskAcknowledged } = req.body;
            const commitment = await investments_service_1.investmentsService.investInCampaign(userId, {
                listingId,
                grossAmount: parseFloat(grossAmount),
                instrument,
                notes,
                riskAcknowledged: riskAcknowledged === true || riskAcknowledged === 'true',
            });
            res.status(201).json({
                success: true,
                message: `Successfully allocated $${commitment.netInvestedAmount} USD to startup (Total debited: $${commitment.grossAmount} USD including ${Number(commitment.allocationFeePct).toFixed(1)}% platform fee)!`,
                data: commitment,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/investments/apply
     * Fund Seeker: Apply for startup funding
     */
    async applyForFunding(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const listing = await investments_service_1.investmentsService.applyForFunding(userId, req.body);
            res.status(201).json({
                success: true,
                message: 'Fundraising application submitted! Our due-diligence review team has been assigned.',
                data: listing,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/investments/watchlist/toggle
     */
    async toggleWatchlist(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const { listingId } = req.body;
            const result = await investments_service_1.investmentsService.toggleWatchlist(userId, listingId);
            res.json({ success: true, ...result });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * POST /api/v1/investments/inquiries
     */
    async submitInquiry(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const inquiry = await investments_service_1.investmentsService.submitInquiry(userId, req.body);
            res.status(201).json({
                success: true,
                message: 'Inquiry submitted to the startup founding team.',
                data: inquiry,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * GET /api/v1/investments/dashboard
     * Investor Dashboard & Fee/Profit-Sharing Reporting
     */
    async getDashboard(req, res, next) {
        try {
            const userId = req.user?.id || req.user?.userId;
            const data = await investments_service_1.investmentsService.getInvestorDashboard(userId);
            res.json({ success: true, data });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.InvestmentsController = InvestmentsController;
exports.investmentsController = new InvestmentsController();
