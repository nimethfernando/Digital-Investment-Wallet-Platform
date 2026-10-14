import { Router } from 'express';
import { ticketController } from '../controllers/ticket.controller';
import { authenticateToken, requireRole } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

// All ticket routes require authentication
router.use(authenticateToken);

// User & Shared endpoints
router.post('/', (req, res, next) => ticketController.createTicket(req, res, next));
router.get('/', (req, res, next) => ticketController.getUserTickets(req, res, next));

// Admin-only ticket management routes (must be defined before /:id parameter)
router.get('/admin/all', requireRole([Role.ADMIN, Role.STAFF]), (req, res, next) =>
  ticketController.getAllTicketsAdmin(req, res, next)
);
router.post('/admin/:id/reply', requireRole([Role.ADMIN, Role.STAFF]), (req, res, next) =>
  ticketController.addReply(req, res, next)
);
router.put('/admin/:id/status', requireRole([Role.ADMIN, Role.STAFF]), (req, res, next) =>
  ticketController.updateTicketStatusAdmin(req, res, next)
);

// Individual ticket endpoints
router.get('/:id', (req, res, next) => ticketController.getTicketDetails(req, res, next));
router.post('/:id/reply', (req, res, next) => ticketController.addReply(req, res, next));
router.post('/:id/close', (req, res, next) => ticketController.closeTicket(req, res, next));

export default router;

