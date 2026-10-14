"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const ticket_controller_1 = require("../controllers/ticket.controller");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
// All ticket routes require authentication
router.use(auth_1.authenticateToken);
// User & Shared endpoints
router.post('/', (req, res, next) => ticket_controller_1.ticketController.createTicket(req, res, next));
router.get('/', (req, res, next) => ticket_controller_1.ticketController.getUserTickets(req, res, next));
// Admin-only ticket management routes (must be defined before /:id parameter)
router.get('/admin/all', (0, auth_1.requireRole)([client_1.Role.ADMIN, client_1.Role.STAFF]), (req, res, next) => ticket_controller_1.ticketController.getAllTicketsAdmin(req, res, next));
router.post('/admin/:id/reply', (0, auth_1.requireRole)([client_1.Role.ADMIN, client_1.Role.STAFF]), (req, res, next) => ticket_controller_1.ticketController.addReply(req, res, next));
router.put('/admin/:id/status', (0, auth_1.requireRole)([client_1.Role.ADMIN, client_1.Role.STAFF]), (req, res, next) => ticket_controller_1.ticketController.updateTicketStatusAdmin(req, res, next));
// Individual ticket endpoints
router.get('/:id', (req, res, next) => ticket_controller_1.ticketController.getTicketDetails(req, res, next));
router.post('/:id/reply', (req, res, next) => ticket_controller_1.ticketController.addReply(req, res, next));
router.post('/:id/close', (req, res, next) => ticket_controller_1.ticketController.closeTicket(req, res, next));
exports.default = router;
