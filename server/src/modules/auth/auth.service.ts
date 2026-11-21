import { ERROR_MESSAGE, MONGO, SECURITY_EVENT, SESSION_REVOKE_REASON } from '../../constants/index.js';
import { digest } from '../../infra/cache/cache.keys.js';
import { securityInfo, securityLog } from '../../infra/security-log.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { userRepository } from './auth.repository.js';
import type { ChangePasswordInput, LoginInput, RegisterInput } from './auth.schemas.js';
import { passwordIssueMessage } from './auth.schemas.js';
import { hashPassword, verifyPassword } from './password.service.js';
import { checkPassword } from './password.policy.js';
import { clean, endAllSessions, startSession, type ClientInfo } from './session.service.js';
import { assertLoginAllowed, clearLoginFailures, recordLoginFailure, throttleRegistration } from './throttle.service.js';

export async function register(input: RegisterInput, client: ClientInfo) {
  await throttleRegistration(client.ip);
  // Hashed before the duplicate check, so "email already taken" costs the same time as a successful sign-up.
  const passwordHash = await hashPassword(input.password);
  let user;
  try {
    user = await userRepository.create({ name: input.name, email: input.email, passwordHash });
  } catch (err) {
    // The unique index is the source of truth; no racy "find then create".
    if ((err as { code?: number }).code === MONGO.DUPLICATE_KEY_CODE) throw HttpError.conflict(ERROR_MESSAGE.EMAIL_TAKEN);
    throw err;
  }
  securityInfo(SECURITY_EVENT.REGISTERED, { userId: String(user._id), ip: client.ip });
  return { user, tokens: await startSession(String(user._id), client) };
}

export async function login(input: LoginInput, client: ClientInfo) {
  const { ip } = clean(client);
  await assertLoginAllowed(input.email, ip);

  const user = await userRepository.findByEmailWithPassword(input.email);
  const check = await verifyPassword(input.password, user?.passwordHash);

  // Same answer, and (because of the dummy hash) about the same time, whether the email exists or the password is wrong.
  if (!user || !check.ok) {
    await recordLoginFailure(input.email, ip);
    securityLog(SECURITY_EVENT.LOGIN_FAILED, { email: digest(input.email), ip, knownAccount: !!user });
    throw HttpError.unauthorized(ERROR_MESSAGE.INVALID_CREDENTIALS);
  }

  await clearLoginFailures(input.email, ip);
  // The stored hash is weaker than today's settings: upgrade it now, while we have the plain password.
  if (check.needsRehash) {
    user.passwordHash = await hashPassword(input.password);
    await user.save();
  }
  securityInfo(SECURITY_EVENT.LOGIN_SUCCEEDED, { userId: String(user._id), ip });
  return { user, tokens: await startSession(String(user._id), client) };
}

export async function currentUser(userId: string) {
  const user = await userRepository.findById(userId);
  if (!user) throw HttpError.unauthorized(ERROR_MESSAGE.ACCOUNT_GONE);
  return user;
}

/** Change the password, then sign out every OTHER device. The caller keeps their session (with fresh tokens). */
export async function changePassword(userId: string, sessionId: string, input: ChangePasswordInput, client: ClientInfo) {
  const user = await userRepository.findByIdWithPassword(userId);
  if (!user) throw HttpError.unauthorized(ERROR_MESSAGE.ACCOUNT_GONE);

  // Guessing the current password here is the same attack as guessing it at the login form, so it shares the same counters.
  await assertLoginAllowed(user.email, client.ip);
  const check = await verifyPassword(input.currentPassword, user.passwordHash);
  if (!check.ok) {
    await recordLoginFailure(user.email, client.ip);
    securityLog(SECURITY_EVENT.LOGIN_FAILED, { userId, ip: client.ip, during: 'password_change' });
    throw HttpError.unauthorized(ERROR_MESSAGE.CURRENT_PASSWORD_WRONG);
  }

  const issues = checkPassword(input.newPassword, { email: user.email, name: user.name });
  if (issues.length) {
    throw HttpError.badRequest(passwordIssueMessage(issues[0]!), issues.map((i) => ({ field: 'newPassword', message: passwordIssueMessage(i) })));
  }

  user.passwordHash = await hashPassword(input.newPassword);
  user.passwordChangedAt = new Date();
  await user.save();

  await endAllSessions(userId, SESSION_REVOKE_REASON.PASSWORD_CHANGED, sessionId);
  securityInfo(SECURITY_EVENT.PASSWORD_CHANGED, { userId, ip: client.ip });
  return user;
}

/** Signs out every device except the one asking. */
export async function signOutOthers(userId: string, sessionId: string, ip: string) {
  await endAllSessions(userId, SESSION_REVOKE_REASON.LOGOUT_OTHERS, sessionId);
  securityInfo(SECURITY_EVENT.LOGOUT_OTHERS, { userId, ip });
}

export async function signOutEverywhere(userId: string, ip: string) {
  await endAllSessions(userId, SESSION_REVOKE_REASON.LOGOUT_ALL);
  securityInfo(SECURITY_EVENT.LOGOUT_ALL, { userId, ip });
}
