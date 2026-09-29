import nodemailer from 'nodemailer';

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
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const host = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const port = Number(process.env.EMAIL_PORT) || 587;

    if (user && pass) {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure: process.env.EMAIL_SECURE === 'true',
        auth: {
          user,
          pass,
        },
      });
    } else {
      console.warn('[NotificationProvider] EMAIL_USER / EMAIL_PASS not set. Emails will be logged to console.');
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const fromAddress = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@nexisplatform.com';
    if (process.env.NODE_ENV === 'test' || !this.transporter) {
      return true;
    }

    try {
      await this.transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });
      return true;
    } catch (error) {
      console.error('[NotificationProvider] Failed to send email:', error);
      return false;
    }
  }

  async sendAdminAlert(subject: string, message: string, meta?: Record<string, any>): Promise<boolean> {
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || process.env.EMAIL_USER;
    if (!adminEmail) return false;

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #1e293b; background: #f8fafc; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">Nexis Operations Alert</h2>
        <h3 style="color: #2563eb;">${subject}</h3>
        <p style="font-size: 15px; line-height: 1.6;">${message}</p>
        ${meta ? `<pre style="background: #e2e8f0; padding: 12px; border-radius: 6px; font-size: 12px; overflow-x: auto;">${JSON.stringify(meta, null, 2)}</pre>` : ''}
        <p style="font-size: 12px; color: #64748b; margin-top: 24px;">Sent automatically by Nexis Digital Investment Platform.</p>
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
