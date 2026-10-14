"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticketController = exports.TicketController = void 0;
const ticket_service_1 = require("../services/ticket.service");
class TicketController {
    /**
     * Create a new support ticket
     */
    async createTicket(req, res, next) {
        try {
            const userId = req.user.id;
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
            const ticket = await ticket_service_1.ticketService.createTicket(userId, {
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
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get all tickets for the authenticated user
     */
    async getUserTickets(req, res, next) {
        try {
            const userId = req.user.id;
            const status = req.query.status;
            const tickets = await ticket_service_1.ticketService.getUserTickets(userId, status);
            res.json({
                success: true,
                data: tickets,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Get ticket details and full reply thread
     */
    async getTicketDetails(req, res, next) {
        try {
            const userId = req.user.id;
            const userRole = req.user.role;
            const ticketId = req.params.id;
            const isAdmin = userRole === 'ADMIN' || userRole === 'STAFF';
            const ticket = await ticket_service_1.ticketService.getTicketDetails(ticketId, userId, isAdmin);
            res.json({
                success: true,
                data: ticket,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Add a message reply to a ticket
     */
    async addReply(req, res, next) {
        try {
            const user = req.user;
            const ticketId = req.params.id;
            const { message } = req.body;
            if (!message || message.trim().length < 1) {
                return res.status(400).json({
                    success: false,
                    message: 'Reply message cannot be empty',
                });
            }
            const senderName = `${user.firstName || 'Client'} ${user.lastName || ''}`.trim() || user.email;
            const senderRole = user.role === 'ADMIN' ? 'ADMIN' : user.role === 'STAFF' ? 'STAFF' : 'USER';
            const result = await ticket_service_1.ticketService.addReply(ticketId, {
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
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * User closes/resolves their ticket
     */
    async closeTicket(req, res, next) {
        try {
            const userId = req.user.id;
            const ticketId = req.params.id;
            // Verify ownership
            const ticket = await ticket_service_1.ticketService.getTicketDetails(ticketId, userId, false);
            if (ticket.userId !== userId) {
                return res.status(403).json({ success: false, message: 'Unauthorized' });
            }
            const updated = await ticket_service_1.ticketService.updateStatus(ticketId, 'RESOLVED');
            res.json({
                success: true,
                message: `Ticket [${updated.ticketNumber}] marked as resolved.`,
                data: updated,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Get all tickets with filtering & pagination
     */
    async getAllTicketsAdmin(req, res, next) {
        try {
            const { status, category, priority, search, page, limit } = req.query;
            const result = await ticket_service_1.ticketService.getAllTicketsAdmin({
                status: status,
                category: category,
                priority: priority,
                search: search,
                page: page ? Number(page) : 1,
                limit: limit ? Number(limit) : 20,
            });
            res.json({
                success: true,
                data: result.tickets,
                pagination: result.pagination,
            });
        }
        catch (err) {
            next(err);
        }
    }
    /**
     * Admin: Update ticket status and internal admin notes
     */
    async updateTicketStatusAdmin(req, res, next) {
        try {
            const ticketId = req.params.id;
            const { status, adminNotes } = req.body;
            if (!status) {
                return res.status(400).json({ success: false, message: 'Status is required' });
            }
            const updated = await ticket_service_1.ticketService.updateStatus(ticketId, status, adminNotes);
            res.json({
                success: true,
                message: `Ticket status updated to ${updated.status}.`,
                data: updated,
            });
        }
        catch (err) {
            next(err);
        }
    }
}
exports.TicketController = TicketController;
exports.ticketController = new TicketController();
