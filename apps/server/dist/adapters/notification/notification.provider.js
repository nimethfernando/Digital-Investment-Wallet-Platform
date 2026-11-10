"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.notificationService = exports.SmtpNotificationProvider = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const config_1 = require("../../config");
class SmtpNotificationProvider {
    name = 'SmtpNotificationProvider';
    transporter = null;
    constructor() {
        const user = config_1.config.email.user;
        const pass = config_1.config.email.pass;
        const host = config_1.config.email.host || 'smtp.gmail.com';
        const port = Number(config_1.config.email.port) || 587;
        if (user && pass) {
            this.transporter = nodemailer_1.default.createTransport({
                host,
                port,
                secure: port === 465,
                auth: {
                    user,
                    pass,
                },
                connectionTimeout: 10000,
                greetingTimeout: 10000,
                socketTimeout: 15000,
            });
            console.log(`[NotificationProvider] SMTP initialized successfully with user: ${user} (${host}:${port})`);
        }
        else {
            console.warn('[NotificationProvider] EMAIL_USER / EMAIL_PASS not set. Emails will be logged to console.');
        }
    }
    async sendEmail(options) {
        const fromAddress = config_1.config.email.from || `Avora Bank <${config_1.config.email.user || 'gnbmailsender@gmail.com'}>`;
        console.log(`[NotificationProvider] Email dispatched to ${options.to} - "${options.subject}"`);
        if (process.env.NODE_ENV === 'test' || !this.transporter) {
            return true;
        }
        // Dispatch asynchronously in background so caller HTTP endpoints NEVER block or hang
        setImmediate(async () => {
            try {
                const emailPromise = this.transporter.sendMail({
                    from: fromAddress,
                    to: options.to,
                    subject: options.subject,
                    html: options.html,
                    text: options.text,
                });
                const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('SMTP connection timed out')), 15000));
                await Promise.race([emailPromise, timeoutPromise]);
            }
            catch (error) {
                console.warn('[NotificationProvider] SMTP background delivery notice:', error?.message || error);
            }
        });
        return true;
    }
    async sendAdminAlert(subject, message, meta) {
        const adminEmail = config_1.config.email.adminNotify || config_1.config.email.user;
        if (!adminEmail)
            return false;
        const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #1e293b; background: #f8fafc; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">Avora Bank Operations Alert</h2>
        <h3 style="color: #2563eb;">${subject}</h3>
        <p style="font-size: 15px; line-height: 1.6;">${message}</p>
        ${meta ? `<pre style="background: #e2e8f0; padding: 12px; border-radius: 6px; font-size: 12px; overflow-x: auto;">${JSON.stringify(meta, null, 2)}</pre>` : ''}
        <p style="font-size: 12px; color: #64748b; margin-top: 24px;">Sent automatically by Avora Bank Digital Investment Platform.</p>
      </div>
    `;
        return this.sendEmail({
            to: adminEmail,
            subject: `[ADMIN ALERT] ${subject}`,
            html,
            text: `${subject}\n\n${message}`,
        });
    }
}
exports.SmtpNotificationProvider = SmtpNotificationProvider;
exports.notificationService = new SmtpNotificationProvider();
