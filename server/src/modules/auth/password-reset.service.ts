import { createHash, randomBytes } from 'node:crypto';
import { appUrl } from '../../config/env.js';
import { ERROR_MESSAGE, PASSWORD_RESET, SECURITY_EVENT, SESSION_REVOKE_REASON, TIME, TOKEN } from '../../constants/index.js';
import { digest } from '../../infra/cache/cache.keys.js';
import { passwordResetMail, sendMail } from '../../infra/mail/index.js';
import { securityInfo, securityLog } from '../../infra/security-log.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { userRepository } from './auth.repository.js';
import { passwordIssueMessage } from './auth.schemas.js';
import { PasswordReset } from './password-reset.model.js';
import { checkPassword } from './password.policy.js';
import { hashPassword } from './password.service.js';
import { endAllSessions, type ClientInfo } from './session.service.js';
import { clearLoginFailures } from './throttle.service.js';

const sha256 = (v: string) => createHash(TOKEN.HASH_ALGORITHM).update(v).digest(TOKEN.HASH_ENCODING);

/**
 * "I forgot my password". Whatever the address is (known, unknown, or asked for too often), the caller gets the same
 * answer, so this cannot be used to find out who has an account. A known address gets an email with a one-time link.
 */
export async function requestPasswordReset(email: string, client: ClientInfo) {
  const user = await userRepository.findByEmail(email);
  securityLog(SECURITY_EVENT.PASSWORD_RESET_REQUESTED, { email: digest(email), ip: client.ip, knownAccount: !!user });
  if (!user) return;

  const hourAgo = new Date(Date.now() - TIME.HOUR_MS);
  if ((await PasswordReset.countDocuments({ user: user._id, createdAt: { $gt: hourAgo } })) >= PASSWORD_RESET.MAX_PER_HOUR) return;

  const token = randomBytes(PASSWORD_RESET.TOKEN_BYTES).toString('base64url');
  // Only the newest link works: asking again cancels the earlier ones.
  await PasswordReset.updateMany({ user: user._id, usedAt: null }, { $set: { usedAt: new Date() } });
  await PasswordReset.create({ user: user._id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + PASSWORD_RESET.TTL_MINUTES * TIME.MINUTE_MS) });

  // In the background: the answer to the request never depends on the mail server.
  void sendMail(passwordResetMail({ to: user.email, name: user.name, url: `${appUrl}/reset-password/${token}`, expiresInMinutes: PASSWORD_RESET.TTL_MINUTES }));
}

/** Sets a new password from the emailed link, then signs the account out everywhere (whoever had it before is out). */
export async function resetPassword(token: string, newPassword: string, client: ClientInfo) {
  const reset = await PasswordReset.findOne({ tokenHash: sha256(token) });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
    securityLog(SECURITY_EVENT.PASSWORD_RESET_BAD_TOKEN, { ip: client.ip });
    throw HttpError.badRequest(ERROR_MESSAGE.RESET_LINK_INVALID);
  }
  const user = await userRepository.findByIdWithPassword(String(reset.user));
  if (!user) throw HttpError.badRequest(ERROR_MESSAGE.RESET_LINK_INVALID);

  const issues = checkPassword(newPassword, { email: user.email, name: user.name });
  if (issues.length) throw HttpError.badRequest(passwordIssueMessage(issues[0]!), issues.map((i) => ({ field: 'newPassword', message: passwordIssueMessage(i) })));

  // Spend the link first (atomically), so two requests with the same link cannot both succeed.
  const spent = await PasswordReset.updateOne({ _id: reset._id, usedAt: null }, { $set: { usedAt: new Date() } });
  if (spent.modifiedCount !== 1) throw HttpError.badRequest(ERROR_MESSAGE.RESET_LINK_INVALID);

  user.passwordHash = await hashPassword(newPassword);
  user.passwordChangedAt = new Date();
  await user.save();
  await endAllSessions(String(user._id), SESSION_REVOKE_REASON.PASSWORD_RESET);
  // A person who just proved they own the mailbox should not stay locked out by earlier wrong guesses.
  await clearLoginFailures(user.email, client.ip);
  securityInfo(SECURITY_EVENT.PASSWORD_RESET_DONE, { userId: String(user._id), ip: client.ip });
}
