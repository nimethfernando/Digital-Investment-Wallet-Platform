import { Router } from 'express';
import { packageController } from '../controllers/package.controller';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Public endpoint to view package rules/tiers
router.get('/tiers', (req, res, next) => packageController.getTiers(req, res, next));

// Authenticated investor endpoints
router.get('/', authenticateToken, (req, res, next) => packageController.getUserPackages(req, res, next));
router.post('/purchase', authenticateToken, (req, res, next) => packageController.purchase(req, res, next));

export default router;
