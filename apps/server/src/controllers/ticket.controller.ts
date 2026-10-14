import { Request, Response, NextFunction } from 'express';
import { ticketService } from '../services/ticket.service';

export class TicketController {
  /**
   * Create a new support ticket
   */
  async createTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const { category, subject, message, priority } = req.body;

      if (!category || !subject || !message) {
        return res.status(400).json({
          success: false,
          message: 'Category, subject, and message are required',
        });
      }

      if (subject.trim().length < 3) {
        return res.status(400).json({
          success: false,
          message: 'Subject must be at least 3 characters',
        });
      }

      if (message.trim().length < 5) {
        return res.status(400).json({
          success: false,
          message: 'Message must be at least 5 characters',
        });
      }

      const ticket = await ticketService.createTicket(userId, {
        category,
        subject,
        message,
        priority,
      });

      res.status(201).json({
        success: true,
        message: `Support ticket [${ticket.ticketNumber}] raised successfully. Our desk has been notified.`,
        data: ticket,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get all tickets for the authenticated user
   */
  async getUserTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const status = req.query.status as string | undefined;
      const tickets = await ticketService.getUserTickets(userId, status);

      res.json({
        success: true,
        data: tickets,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get ticket details and full reply thread
   */
  async getTicketDetails(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const userRole = (req as any).user.role;
      const ticketId = req.params.id as string;
      const isAdmin = userRole === 'ADMIN' || userRole === 'STAFF';

      const ticket = await ticketService.getTicketDetails(ticketId, userId, isAdmin);

      res.json({
        success: true,
        data: ticket,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Add a message reply to a ticket
   */
  async addReply(req: Request, res: Response, next: NextFunction) {
    try {
      const user = (req as any).user;
      const ticketId = req.params.id as string;
      const { message } = req.body;

      if (!message || message.trim().length < 1) {
        return res.status(400).json({
          success: false,
          message: 'Reply message cannot be empty',
        });
      }

      const senderName = `${user.firstName || 'Client'} ${user.lastName || ''}`.trim() || user.email;
      const senderRole = user.role === 'ADMIN' ? 'ADMIN' : user.role === 'STAFF' ? 'STAFF' : 'USER';

      const result = await ticketService.addReply(ticketId, {
        senderId: user.id,
        senderName,
        senderRole,
        message,
      });

      res.status(201).json({
        success: true,
        message: 'Reply dispatched to ticket thread.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * User closes/resolves their ticket
   */
  async closeTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = (req as any).user.id;
      const ticketId = req.params.id as string;

      // Verify ownership
      const ticket = await ticketService.getTicketDetails(ticketId, userId, false);
      if (ticket.userId !== userId) {
        return res.status(403).json({ success: false, message: 'Unauthorized' });
      }

      const updated = await ticketService.updateStatus(ticketId, 'RESOLVED');

      res.json({
        success: true,
        message: `Ticket [${updated.ticketNumber}] marked as resolved.`,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Get all tickets with filtering & pagination
   */
  async getAllTicketsAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, category, priority, search, page, limit } = req.query;

      const result = await ticketService.getAllTicketsAdmin({
        status: status as string,
        category: category as string,
        priority: priority as string,
        search: search as string,
        page: page ? Number(page) : 1,
        limit: limit ? Number(limit) : 20,
      });

      res.json({
        success: true,
        data: result.tickets,
        pagination: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * Admin: Update ticket status and internal admin notes
   */
  async updateTicketStatusAdmin(req: Request, res: Response, next: NextFunction) {
    try {
      const ticketId = req.params.id as string;
      const { status, adminNotes } = req.body;

      if (!status) {
        return res.status(400).json({ success: false, message: 'Status is required' });
      }

      const updated = await ticketService.updateStatus(ticketId, status, adminNotes);

      res.json({
        success: true,
        message: `Ticket status updated to ${updated.status}.`,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const ticketController = new TicketController();

