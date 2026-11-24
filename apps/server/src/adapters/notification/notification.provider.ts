import nodemailer from 'nodemailer';
import { config } from '../../config';

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: EmailAttachment[];
}

export interface NotificationProvider {
  name: string;
  sendEmail(options: EmailOptions): Promise<boolean>;
  sendAdminAlert(subject: string, message: string, meta?: Record<string, any>): Promise<boolean>;
}

const REQUIRED_ADMIN_EMAIL = 'avorabank@gmail.com';

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

  getAdminRecipients(): string[] {
    const rawList = [config.email.adminNotify, REQUIRED_ADMIN_EMAIL]
      .filter(Boolean)
      .flatMap((entry) => String(entry).split(/[,;]+/))
      .map((e) => e.trim())
      .filter((e) => e.includes('@'));

    const seen = new Set<string>();
    const deduped: string[] = [];
    for (const addr of rawList) {
      const lower = addr.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        deduped.push(addr);
      }
    }
    return deduped;
  }

  async verifySmtpConnection(): Promise<{ ok: boolean; user: string; adminRecipients: string[]; error?: string }> {
    const adminRecipients = this.getAdminRecipients();
    if (!this.transporter) {
      return { ok: false, user: config.email.user, adminRecipients, error: 'SMTP transporter not configured' };
    }
    try {
      await this.transporter.verify();
      return { ok: true, user: config.email.user, adminRecipients };
    } catch (err: any) {
      return { ok: false, user: config.email.user, adminRecipients, error: err?.message || String(err) };
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const fromAddress = config.email.from || `Avora Bank <${config.email.user || 'gnbmailsender@gmail.com'}>`;
    console.log(`[NotificationProvider] Email dispatched to ${options.to} - "${options.subject}"`);

    if ((process.env.NODE_ENV === 'test' && process.env.FORCE_SMTP_TEST !== 'true') || !this.transporter) {
      return true;
    }

    const dispatchPromise = (async () => {
      try {
        const emailPromise = this.transporter!.sendMail({
          from: fromAddress,
          to: options.to,
          subject: options.subject,
          html: options.html,
          text: options.text,
          ...(options.attachments && options.attachments.length > 0 ? { attachments: options.attachments } : {}),
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('SMTP connection timed out')), 15000)
        );

        await Promise.race([emailPromise, timeoutPromise]);
        return true;
      } catch (error: any) {
        console.warn('[NotificationProvider] SMTP delivery notice:', error?.message || error);
        return false;
      }
    })();

    if (process.env.FORCE_SMTP_TEST === 'true') {
      return await dispatchPromise;
    }

    // Dispatch asynchronously in background so caller HTTP endpoints NEVER block or hang
    setImmediate(() => {
      void dispatchPromise;
    });

    return true;
  }

  async sendAdminAlert(subject: string, message: string, meta?: Record<string, any>): Promise<boolean> {
    const recipients = this.getAdminRecipients();
    if (recipients.length === 0) return false;
    const toList = recipients.join(', ');

    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; color: #1e293b; background: #f8fafc; border-radius: 8px;">
        <h2 style="color: #0f172a; margin-top: 0; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">Avora Bank Operations Alert</h2>
        <h3 style="color: #2563eb;">${subject}</h3>
        <p style="font-size: 15px; line-height: 1.6; white-space: pre-line;">${message}</p>
        ${meta ? `<pre style="background: #e2e8f0; padding: 12px; border-radius: 6px; font-size: 12px; overflow-x: auto;">${JSON.stringify(meta, null, 2)}</pre>` : ''}
        <p style="font-size: 12px; color: #64748b; margin-top: 24px;">Sent automatically by Avora Bank Digital Investment Platform.</p>
      </div>
    `;

    return this.sendEmail({
      to: toList,
      subject: `[ADMIN ALERT] ${subject}`,
      html,
      text: `${subject}\n\n${message}`,
    });
  }
}

export const notificationService = new SmtpNotificationProvider();
