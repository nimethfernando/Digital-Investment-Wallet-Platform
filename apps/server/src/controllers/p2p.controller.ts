import { Request, Response, NextFunction } from 'express';
import { p2pService } from '../services/p2p.service';

export class P2PController {
  /**
   * Preview recipient details before transfer confirmation
   */
  async lookupRecipient(req: Request, res: Response, next: NextFunction) {
    try {
      const senderUserId = (req as any).user.id;
      const { identifier } = req.body;

      if (!identifier) {
        return res.status(400).json({
          success: false,
          message: 'Recipient identifier (email or User ID) is required',
        });
      }

      const preview = await p2pService.lookupRecipient(senderUserId, identifier);
      res.json({
        success: true,
        data: preview,
      });
    } catch (err: any) {
      next(err);
    }
  }

  /**
   * Execute P2P balance transfer
   */
  async transferFunds(req: Request, res: Response, next: NextFunction) {
    try {
      const senderUserId = (req as any).user.id;
      const { recipientIdentifier, amount, currency, notes, twoFactorCode } = req.body;

      if (!recipientIdentifier || !amount) {
        return res.status(400).json({
          success: false,
          message: 'Recipient identifier and amount are required',
        });
      }

      const result = await p2pService.executeTransfer(senderUserId, {
        recipientIdentifier,
        amount,
        currency,
        notes,
        twoFactorCode,
      });

      res.status(200).json({
        success: true,
        message: `Successfully transferred $${result.amount} ${result.currency} to ${result.recipient.fullName}.`,
        data: result,
      });
    } catch (err: any) {
      next(err);
    }
  }
}

export const p2pController = new P2PController();
