import { Request, Response, NextFunction } from 'express';
import { ventureMatchmakingService } from '../services/ventureMatchmaking.service';

export class VentureMatchmakingController {
  /**
   * GET /api/v1/investments/dealflow/opportunities
   * List dealflow opportunities with search & filters
   */
  async listOpportunities(req: Request, res: Response, next: NextFunction) {
    try {
      const { intent, dealType, industry, search, status } = req.query as Record<string, string>;
      const list = await ventureMatchmakingService.listOpportunities({
        intent,
        dealType,
        industry,
        search,
        status,
      });
      res.json({ success: true, count: list.length, data: list });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/investments/dealflow/opportunities/:id
   * Get single opportunity detail
   */
  async getOpportunity(req: Request, res: Response, next: NextFunction) {
    try {
      const viewerUserId = (req as any).user?.id || (req as any).user?.userId;
      const opp = await ventureMatchmakingService.getOpportunityById(String(req.params.id), viewerUserId);
      res.json({ success: true, data: opp });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/investments/dealflow/opportunities
   * Create a new dealflow opportunity post (Registered users only)
   */
  async createOpportunity(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }
      const opp = await ventureMatchmakingService.createOpportunity(userId, req.body);
      res.status(201).json({
        success: true,
        message: 'Opportunity posted successfully! It is now live in the dealflow directory.',
        data: opp,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/investments/dealflow/opportunities/:id/apply
   * Apply / Express Interest in an opportunity (Registered users only)
   */
  async applyToOpportunity(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Only registered users on Avora Bank can apply to opportunities.',
        });
      }
      const result = await ventureMatchmakingService.applyToOpportunity(userId, String(req.params.id), req.body);
      res.status(201).json({
        success: true,
        message: result.message,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/investments/dealflow/my-posts
   * List opportunities posted by current user
   */
  async getMyOpportunities(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }
      const list = await ventureMatchmakingService.listOpportunities({ userId, status: 'ALL' });
      res.json({ success: true, count: list.length, data: list });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/investments/dealflow/my-applications
   * List applications submitted by current user
   */
  async getMyApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      if (!userId) {
        return res.status(401).json({ success: false, message: 'Authentication required.' });
      }
      const list = await ventureMatchmakingService.getMyApplications(userId);
      res.json({ success: true, count: list.length, data: list });
    } catch (err) {
      next(err);
    }
  }

  // =========================================================================
  // ADMIN MATCHMAKING & CURATION DESK
  // =========================================================================

  /**
   * GET /api/v1/admin/dealflow/opportunities
   */
  async adminListOpportunities(req: Request, res: Response, next: NextFunction) {
    try {
      const { intent, dealType, status, search } = req.query as Record<string, string>;
      const list = await ventureMatchmakingService.listOpportunities({
        intent,
        dealType,
        status: status || 'ALL',
        search,
      });
      res.json({ success: true, count: list.length, data: list });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/admin/dealflow/applications
   */
  async adminListApplications(req: Request, res: Response, next: NextFunction) {
    try {
      const { opportunityId, status, dealType, intent, search } = req.query as Record<string, string>;
      const list = await ventureMatchmakingService.adminListApplications({
        opportunityId,
        status,
        dealType,
        intent,
        search,
      });
      res.json({ success: true, count: list.length, data: list });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/admin/dealflow/applications/:id
   * Facilitate connection / shortlist / decline application
   */
  async adminUpdateApplicationStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const adminId = (req as any).user?.id || (req as any).user?.userId || 'admin';
      const result = await ventureMatchmakingService.adminUpdateApplicationStatus(
        String(req.params.id),
        adminId,
        req.body
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/admin/dealflow/opportunities/:id
   */
  async adminUpdateOpportunityStatus(req: Request, res: Response, next: NextFunction) {
    try {
      const adminId = (req as any).user?.id || (req as any).user?.userId || 'admin';
      const result = await ventureMatchmakingService.adminUpdateOpportunityStatus(
        String(req.params.id),
        adminId,
        req.body
      );
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
}

export const ventureMatchmakingController = new VentureMatchmakingController();
