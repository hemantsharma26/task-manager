import { env } from '../../config/env.js';
import { MAIL, MAIL_LOG } from '../../constants/index.js';
import { logger } from '../logger.js';
import { createMailer, type Mailer, type OutgoingMail } from './mailer.js';

export { assignmentMail, invitationMail, escapeHtml } from './templates.js';
export { SmtpMailer, LogOnlyMailer, type Mailer, type OutgoingMail } from './mailer.js';

let mailer: Mailer = createMailer(env.SMTP_URL);
logger.info(MAIL_LOG.TRANSPORT(mailer.kind));

/** Tests swap the transport; production never calls this. */
export const useMailer = (next: Mailer) => {
  mailer = next;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Queue an email and return at once. The request that triggered it (an invitation, an assignment) must never wait
 * for, or fail because of, a mail server, so delivery runs in the background with a few retries, and a failure is
 * logged instead of thrown. The returned promise resolves when delivery has finished, which tests wait for.
 */
export function sendMail(mail: OutgoingMail, retryDelayMs: number = MAIL.RETRY_DELAY_MS): Promise<boolean> {
  return (async () => {
    for (let attempt = 1; attempt <= MAIL.MAX_ATTEMPTS; attempt++) {
      try {
        await mailer.send(mail);
        logger.debug({ to: mail.to, subject: mail.subject }, MAIL_LOG.SENT);
        return true;
      } catch (err) {
        logger.warn({ to: mail.to, attempt, err: (err as Error).message }, MAIL_LOG.FAILED);
        if (attempt < MAIL.MAX_ATTEMPTS) await sleep(retryDelayMs * attempt);
      }
    }
    logger.error({ to: mail.to, subject: mail.subject }, MAIL_LOG.GAVE_UP);
    return false;
  })();
}

export const closeMail = () => mailer.close();
