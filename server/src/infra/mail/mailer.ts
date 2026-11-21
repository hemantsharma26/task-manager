import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../../config/env.js';
import { MAIL_LOG, MAIL_TRANSPORT } from '../../constants/index.js';
import { logger } from '../logger.js';

export interface OutgoingMail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface Mailer {
  readonly kind: string;
  send(mail: OutgoingMail): Promise<void>;
  close(): void;
}

/** Real delivery through any SMTP server (Gmail, SES, Mailgun, a company relay, ...). */
export class SmtpMailer implements Mailer {
  readonly kind = MAIL_TRANSPORT.SMTP;
  private readonly transport: Transporter;

  constructor(url: string) {
    // Timeouts keep a stuck mail server from holding connections open forever.
    this.transport = nodemailer.createTransport({ url, connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 20_000 });
  }

  async send(mail: OutgoingMail) {
    await this.transport.sendMail({ from: env.MAIL_FROM, ...mail });
  }

  close() {
    this.transport.close();
  }
}

/** Without SMTP nothing is sent; the email is printed in the log so you can still see (and click) the link in development. */
export class LogOnlyMailer implements Mailer {
  readonly kind = MAIL_TRANSPORT.LOG_ONLY;

  async send(mail: OutgoingMail) {
    logger.info({ to: mail.to, subject: mail.subject, text: mail.text }, MAIL_LOG.LOG_ONLY);
  }

  close() {}
}

export const createMailer = (smtpUrl: string | undefined): Mailer => (smtpUrl ? new SmtpMailer(smtpUrl) : new LogOnlyMailer());
