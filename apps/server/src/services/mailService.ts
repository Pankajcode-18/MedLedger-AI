import nodemailer, { Transporter } from 'nodemailer';
import { config } from '../config/index.js';

/**
 * Sends account emails (password-reset links) through the SMTP server in SMTP_HOST.
 * Without one, nothing is sent and the caller prints the link in the server log instead.
 */
class MailService {
  private transporter: Transporter | null = null;

  public get enabled(): boolean {
    return Boolean(config.smtp.host);
  }

  private transport(): Transporter {
    if (!this.transporter) {
      const { host, port, secure, user, pass } = config.smtp;
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        ...(user ? { auth: { user, pass } } : {})
      });
    }
    return this.transporter;
  }

  /** Returns true when the email was handed to the SMTP server. */
  public async sendPasswordReset(to: string, name: string, link: string, minutes: number): Promise<boolean> {
    if (!this.enabled) return false;
    await this.transport().sendMail({
      from: config.smtp.from,
      to,
      subject: 'Reset your MedLedger AI password',
      text:
        `Hello ${name},\n\n` +
        `Someone asked to reset the password for your MedLedger AI account. To choose a new password, open this link ` +
        `within ${minutes} minutes:\n\n${link}\n\n` +
        `If you did not ask for this, you can ignore this email. Your password stays the same.\n`,
      html:
        `<p>Hello ${escapeHtml(name)},</p>` +
        `<p>Someone asked to reset the password for your MedLedger AI account. To choose a new password, open this link within ${minutes} minutes:</p>` +
        `<p><a href="${escapeHtml(link)}">Reset my password</a></p>` +
        `<p>If you did not ask for this, you can ignore this email. Your password stays the same.</p>`
    });
    return true;
  }
}

const escapeHtml = (s: string): string =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] as string);

export const mailService = new MailService();
