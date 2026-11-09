import nodemailer from 'nodemailer';
import { config } from '../../config';

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface NotificationProvider {
  name: string;
  sendEmail(options: EmailOptions): Promise<boolean>;
  sendAdminAlert(subject: string, message: string, meta?: Record<string, any>): Promise<boolean>;
}

export class SmtpNotificationProvider implements NotificationProvider {
  name = 'SmtpNotificationProvider';
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    const user = config.email.user;
    const pass = config.email.pass;
    const host = config.email.host || 'smtp.gmail.com';
    const port = Number(config.email.port) || 587;

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
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
    } else {
      console.warn('[NotificationProvider] EMAIL_USER / EMAIL_PASS not set. Emails will be logged to console.');
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const fromAddress = config.email.from || `Avora Bank <${config.email.user || 'gnbmailsender@gmail.com'}>`;
    console.log(`[NotificationProvider] Email dispatched to ${options.to} - "${options.subject}"`);

    if (process.env.NODE_ENV === 'test' || !this.transporter) {
      return true;
    }

    // Dispatch asynchronously in background so caller HTTP endpoints NEVER block or hang
    setImmediate(async () => {
      try {
        const emailPromise = this.transporter!.sendMail({
          from: fromAddress,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('SMTP connection timed out')), 15000)
        );

        await Promise.race([emailPromise, timeoutPromise]);
      } catch (error: any) {
        console.warn('[NotificationProvider] SMTP background delivery notice:', error?.message || error);
      }
    });

    return true;
  }

  async sendAdminAlert(subject: string, message: string, meta?: Record<string, any>): Promise<boolean> {
    const adminEmail = config.email.adminNotify || config.email.user;
    if (!adminEmail) return false;

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

export const notificationService = new SmtpNotificationProvider();
