"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ticketService = exports.TicketService = void 0;
const prisma_1 = require("../lib/prisma");
const notification_provider_1 = require("../adapters/notification/notification.provider");
class TicketService {
    /**
     * Create a new support ticket
     */
    async createTicket(userId, data) {
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, email: true, firstName: true, lastName: true },
        });
        if (!user) {
            throw new Error('User not found');
        }
        // Generate unique human-readable ticket number e.g. TKT-7291-8402
        const randCode = Math.floor(1000 + Math.random() * 9000);
        const timeCode = Date.now().toString().slice(-4);
        const ticketNumber = `TKT-${randCode}-${timeCode}`;
        const priority = data.priority || 'MEDIUM';
        const validPriorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
        const safePriority = validPriorities.includes(priority.toUpperCase()) ? priority.toUpperCase() : 'MEDIUM';
        const ticket = await prisma_1.prisma.supportTicket.create({
            data: {
                ticketNumber,
                userId,
                category: data.category.toUpperCase(),
                priority: safePriority,
                status: 'OPEN',
                subject: data.subject.trim(),
                message: data.message.trim(),
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                replies: true,
            },
        });
        // Alert admin desk
        try {
            await notification_provider_1.notificationService.sendAdminAlert(`🚨 New Support Ticket: [${ticket.ticketNumber}] ${ticket.subject}`, `Investor: ${user.firstName} ${user.lastName} (${user.email})\nCategory: ${ticket.category}\nPriority: ${ticket.priority}\n\nMessage:\n${ticket.message}`, { ticketId: ticket.id, ticketNumber: ticket.ticketNumber });
        }
        catch (e) {
            console.warn('Failed to dispatch admin notification:', e);
        }
        return ticket;
    }
    /**
     * Get all tickets for a specific user
     */
    async getUserTickets(userId, status) {
        const where = { userId };
        if (status && status !== 'ALL') {
            where.status = status;
        }
        const tickets = await prisma_1.prisma.supportTicket.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
            include: {
                replies: {
                    orderBy: { createdAt: 'desc' },
                    take: 1,
                },
                _count: {
                    select: { replies: true },
                },
            },
        });
        return tickets.map((t) => ({
            id: t.id,
            ticketNumber: t.ticketNumber,
            category: t.category,
            priority: t.priority,
            status: t.status,
            subject: t.subject,
            message: t.message,
            adminNotes: t.adminNotes,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
            replyCount: t._count.replies,
            lastReply: t.replies[0] || null,
        }));
    }
    /**
     * Get a ticket by ID with full reply thread
     */
    async getTicketDetails(ticketId, userId, isAdmin = false) {
        const ticket = await prisma_1.prisma.supportTicket.findUnique({
            where: { id: ticketId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        firstName: true,
                        lastName: true,
                    },
                },
                replies: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        if (!ticket) {
            throw new Error('Ticket not found');
        }
        // Access control
        if (!isAdmin && userId && ticket.userId !== userId) {
            throw new Error('Unauthorized to view this ticket');
        }
        return ticket;
    }
    /**
     * Add a reply to an existing ticket
     */
    async addReply(ticketId, params) {
        const ticket = await prisma_1.prisma.supportTicket.findUnique({
            where: { id: ticketId },
        });
        if (!ticket) {
            throw new Error('Ticket not found');
        }
        if (ticket.status === 'CLOSED') {
            throw new Error('Cannot reply to a closed ticket. Please open a new ticket.');
        }
        // Determine status update:
        // If Admin replies -> WAITING_USER
        // If User replies -> OPEN / IN_REVIEW
        let newStatus = ticket.status;
        if (params.senderRole === 'ADMIN' || params.senderRole === 'STAFF') {
            newStatus = 'WAITING_USER';
        }
        else {
            if (ticket.status === 'WAITING_USER' || ticket.status === 'RESOLVED') {
                newStatus = 'OPEN';
            }
        }
        const [reply, updatedTicket] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.ticketReply.create({
                data: {
                    ticketId,
                    senderId: params.senderId,
                    senderName: params.senderName,
                    senderRole: params.senderRole,
                    message: params.message.trim(),
                },
            }),
            prisma_1.prisma.supportTicket.update({
                where: { id: ticketId },
                data: {
                    status: newStatus,
                    updatedAt: new Date(),
                },
            }),
        ]);
        return {
            reply,
            ticket: updatedTicket,
        };
    }
    /**
     * Update status or admin notes (Admin or user close)
     */
    async updateStatus(ticketId, status, adminNotes) {
        const validStatuses = ['OPEN', 'IN_REVIEW', 'WAITING_USER', 'RESOLVED', 'CLOSED'];
        if (!validStatuses.includes(status.toUpperCase())) {
            throw new Error(`Invalid status: ${status}. Must be one of: ${validStatuses.join(', ')}`);
        }
        return prisma_1.prisma.supportTicket.update({
            where: { id: ticketId },
            data: {
                status: status.toUpperCase(),
                ...(adminNotes !== undefined ? { adminNotes } : {}),
                updatedAt: new Date(),
            },
        });
    }
    /**
     * Get all tickets across platform for Admin Desk
     */
    async getAllTicketsAdmin(params) {
        const page = params.page || 1;
        const limit = params.limit || 20;
        const skip = (page - 1) * limit;
        const where = {};
        if (params.status && params.status !== 'ALL') {
            where.status = params.status;
        }
        if (params.category && params.category !== 'ALL') {
            where.category = params.category;
        }
        if (params.priority && params.priority !== 'ALL') {
            where.priority = params.priority;
        }
        if (params.search) {
            const q = params.search.trim();
            where.OR = [
                { ticketNumber: { contains: q } },
                { subject: { contains: q } },
                { user: { email: { contains: q } } },
            ];
        }
        const [tickets, total] = await Promise.all([
            prisma_1.prisma.supportTicket.findMany({
                where,
                skip,
                take: limit,
                orderBy: { updatedAt: 'desc' },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            firstName: true,
                            lastName: true,
                        },
                    },
                    _count: {
                        select: { replies: true },
                    },
                },
            }),
            prisma_1.prisma.supportTicket.count({ where }),
        ]);
        return {
            tickets: tickets.map((t) => ({
                id: t.id,
                ticketNumber: t.ticketNumber,
                category: t.category,
                priority: t.priority,
                status: t.status,
                subject: t.subject,
                message: t.message,
                adminNotes: t.adminNotes,
                createdAt: t.createdAt,
                updatedAt: t.updatedAt,
                replyCount: t._count.replies,
                user: t.user,
            })),
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
exports.TicketService = TicketService;
exports.ticketService = new TicketService();
