import { Request, Response, NextFunction } from 'express';
import { packageService } from '../services/package.service';

export class PackageController {
  /**
   * Get authenticated user's investment packages
   */
  async getUserPackages(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const packages = await packageService.getUserPackages(userId);
      res.json({ success: true, data: packages });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get package settings / tiers configuration
   */
  async getTiers(req: Request, res: Response, next: NextFunction) {
    try {
      const rules = await packageService.getPackageSettings();
      res.json({ success: true, data: rules });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Purchase an investment package
   */
  async purchase(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { amount, depositMethod, proofUrl, txHashOrRef } = req.body;

      if (!amount || !depositMethod) {
        return res.status(400).json({ success: false, message: 'Amount and deposit method are required' });
      }

      const result = await packageService.purchasePackage(userId, {
        amount,
        depositMethod,
        proofUrl,
        txHashOrRef,
      });

      res.status(201).json(result);
    } catch (err: any) {
      next(err);
    }
  }
}

export const packageController = new PackageController();
