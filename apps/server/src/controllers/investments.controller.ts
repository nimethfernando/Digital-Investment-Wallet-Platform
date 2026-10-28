import { Request, Response, NextFunction } from 'express';
import { investmentsService } from '../services/investments.service';

export class InvestmentsController {
  /**
   * GET /api/v1/investments/campaigns
   * Public: List all published startup funding opportunities
   */
  async listCampaigns(req: Request, res: Response, next: NextFunction) {
    try {
      const { industry, countryCode, stage, instrument, search } = req.query as any;
      const campaigns = await investmentsService.listCampaigns({
        industry,
        countryCode,
        stage,
        instrument,
        search,
      });
      res.json({ success: true, data: campaigns });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/investments/campaigns/:slug
   * Public/Protected: Get detailed campaign profile
   */
  async getCampaign(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const slug = Array.isArray(req.params.slug) ? req.params.slug[0] : String(req.params.slug);
      const campaign = await investmentsService.getCampaignBySlug(slug, userId);
      res.json({ success: true, data: campaign });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/investments/fee-quote
   * Calculate 5% investment allocation fee breakdown
   */
  calculateFee(req: Request, res: Response, next: NextFunction) {
    try {
      const { grossAmount } = req.body;
      const breakdown = investmentsService.calculateInvestmentFee(parseFloat(grossAmount));
      res.json({ success: true, data: breakdown });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/investments/invest
   * Commit and fund investment from wallet (with 5% allocation fee)
   */
  async invest(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const { listingId, grossAmount, instrument, notes } = req.body;
      const commitment = await investmentsService.investInCampaign(userId, {
        listingId,
        grossAmount: parseFloat(grossAmount),
        instrument,
        notes,
      });
      res.status(201).json({
        success: true,
        message: `Successfully invested $${commitment.grossAmount} USD (including 5% allocation fee)!`,
        data: commitment,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/investments/apply
   * Fund Seeker: Apply for startup funding
   */
  async applyForFunding(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const listing = await investmentsService.applyForFunding(userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Fundraising application submitted! Our due-diligence review team has been assigned.',
        data: listing,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/investments/watchlist/toggle
   */
  async toggleWatchlist(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const { listingId } = req.body;
      const result = await investmentsService.toggleWatchlist(userId, listingId);
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/investments/inquiries
   */
  async submitInquiry(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const inquiry = await investmentsService.submitInquiry(userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Inquiry submitted to the startup founding team.',
        data: inquiry,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/investments/dashboard
   * Investor Dashboard & Fee/Profit-Sharing Reporting
   */
  async getDashboard(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const data = await investmentsService.getInvestorDashboard(userId);
      res.json({ success: true, data });
    } catch (err) {
      next(err);
    }
  }
}

export const investmentsController = new InvestmentsController();
