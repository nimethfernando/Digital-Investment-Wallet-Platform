import { Request, Response, NextFunction } from 'express';
import { globalMoneyTransferService, DESTINATION_COUNTRIES } from '../services/gmt.service';

export class GlobalMoneyTransferController {
  /**
   * GET /api/v1/gmt/countries
   * List supported destination countries
   */
  getCountries(req: Request, res: Response) {
    res.json({ success: true, data: DESTINATION_COUNTRIES });
  }

  /**
   * POST /api/v1/gmt/quote
   * Calculate binding exchange rate quote with 2% adjustment & 3% fee
   */
  calculateQuote(req: Request, res: Response, next: NextFunction) {
    try {
      const { sendingCurrency, sendingAmount, destinationCountryCode, recipientCurrency } = req.body;
      const quote = globalMoneyTransferService.calculateQuote({
        sendingCurrency: sendingCurrency || 'USD',
        sendingAmount: parseFloat(sendingAmount),
        destinationCountryCode: destinationCountryCode || 'IN',
        recipientCurrency: recipientCurrency || 'INR',
      });
      res.json({ success: true, data: quote });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/gmt/transfers
   * Submit and fund a global transfer
   */
  async createTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const transfer = await globalMoneyTransferService.createTransfer(userId, req.body);
      res.status(201).json({
        success: true,
        message: `Global Money Transfer ${transfer.transferCode} initiated successfully!`,
        data: transfer,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/gmt/transfers
   * List user's transfers
   */
  async listUserTransfers(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const transfers = await globalMoneyTransferService.listUserTransfers(userId);
      res.json({ success: true, data: transfers });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/gmt/transfers/:code
   * Track specific transfer
   */
  async getTransfer(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user?.id || (req as any).user?.userId;
      const code = Array.isArray(req.params.code) ? req.params.code[0] : String(req.params.code);
      const transfer = await globalMoneyTransferService.getTransfer(code, userId);
      res.json({ success: true, data: transfer });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/gmt/admin/transfers
   * Admin: List all transfers
   */
  async listAllTransfersAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const status = req.query.status as string | undefined;
      const transfers = await globalMoneyTransferService.listAllTransfersAdmin(status);
      res.json({ success: true, data: transfers });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/gmt/admin/transfers/:id
   * Admin: Update transfer status
   */
  async updateTransferStatusAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, notes } = req.body;
      const id = Array.isArray(req.params.id) ? req.params.id[0] : String(req.params.id);
      const updated = await globalMoneyTransferService.updateTransferStatusAdmin(id, status, notes);
      res.json({ success: true, message: `Transfer status updated to ${status}`, data: updated });
    } catch (err) {
      next(err);
    }
  }
}

export const gmtController = new GlobalMoneyTransferController();
