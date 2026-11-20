import { createHash, randomBytes } from 'node:crypto';
import { env } from '../../config/env.js';
import { ERROR_MESSAGE, SECURITY_EVENT, SESSION_REVOKE_REASON, TIME, TOKEN, USER_AGENT_MAX_LENGTH } from '../../constants/index.js';
import { securityLog } from '../../infra/security-log.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { denyAllIssuedBefore, denySession } from './revocation.service.js';
import { sessionRepository } from './session.repository.js';
import { signAccessToken } from './token.service.js';

export interface ClientInfo {
  ip: string;
  userAgent: string;
}

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  refreshExpiresAt: Date;
  sessionId: string;
}

const sha256 = (value: string) => createHash(TOKEN.HASH_ALGORITHM).update(value).digest(TOKEN.HASH_ENCODING);
const newRefreshToken = () => randomBytes(TOKEN.REFRESH_BYTES).toString('base64url');
export const clean = (c: ClientInfo): ClientInfo => ({ ip: c.ip, userAgent: (c.userAgent ?? '').slice(0, USER_AGENT_MAX_LENGTH) });

/** The idle window, but never later than the hard limit. */
const nextExpiry = (absolute: Date) => new Date(Math.min(Date.now() + env.REFRESH_TOKEN_DAYS * TIME.DAY_MS, absolute.getTime()));

export async function startSession(userId: string, client: ClientInfo): Promise<IssuedTokens> {
  const refreshToken = newRefreshToken();
  const absoluteExpiresAt = new Date(Date.now() + env.SESSION_MAX_DAYS * TIME.DAY_MS);
  const session = await sessionRepository.create({ user: userId, tokenHash: sha256(refreshToken), expiresAt: nextExpiry(absoluteExpiresAt), absoluteExpiresAt, ...clean(client) });
  return { accessToken: signAccessToken(userId, String(session._id)), refreshToken, refreshExpiresAt: session.expiresAt, sessionId: String(session._id) };
}

/**
 * Trade a refresh token for a new pair. The old refresh token stops working the moment this succeeds ("rotation").
 * If an OLD token shows up again later, somebody kept a copy: the whole session is revoked and its owner has to sign in.
 */
export async function refreshSession(presented: string, client: ClientInfo): Promise<IssuedTokens & { userId: string }> {
  const info = clean(client);
  const presentedHash = sha256(presented);

  // Two tabs refreshing at the same instant both arrive holding the same token. One wins the swap; the other must not
  // be thrown out, so it looks again (it will now find the token it holds has just been replaced, which is the grace case).
  for (let attempt = 0; attempt < 3; attempt++) {
    let session = await sessionRepository.findByTokenHash(presentedHash);
    let rotateFrom = presentedHash;

    if (!session) {
      const old = await sessionRepository.findByPreviousTokenHash(presentedHash);
      if (!old || old.revokedAt) throw HttpError.unauthorized(ERROR_MESSAGE.REFRESH_INVALID);

      const justRotated = old.rotatedAt && Date.now() - old.rotatedAt.getTime() <= TOKEN.REFRESH_GRACE_MS;
      if (!justRotated) {
        // An old token, long after it was replaced: somebody kept a copy. End the whole session.
        await sessionRepository.revoke(old._id, SESSION_REVOKE_REASON.REUSE_DETECTED);
        await denySession(String(old._id));
        securityLog(SECURITY_EVENT.REFRESH_REUSE_DETECTED, { userId: String(old.user), sessionId: String(old._id), ip: info.ip });
        throw HttpError.unauthorized(ERROR_MESSAGE.REFRESH_INVALID);
      }
      session = old;
      rotateFrom = old.tokenHash; // the token that is current now
    }

    const now = Date.now();
    if (session.revokedAt || session.expiresAt.getTime() <= now || session.absoluteExpiresAt.getTime() <= now) {
      throw HttpError.unauthorized(ERROR_MESSAGE.REFRESH_INVALID);
    }

    const refreshToken = newRefreshToken();
    const rotated = await sessionRepository.rotate(session._id, rotateFrom, { tokenHash: sha256(refreshToken), expiresAt: nextExpiry(session.absoluteExpiresAt), ...info });
    if (!rotated) continue; // someone else moved this session on first; look again

    const userId = String(rotated.user);
    return { userId, accessToken: signAccessToken(userId, String(rotated._id)), refreshToken, refreshExpiresAt: rotated.expiresAt, sessionId: String(rotated._id) };
  }
  throw HttpError.unauthorized(ERROR_MESSAGE.REFRESH_INVALID);
}

/** Ends the session that owns this refresh token and/or this session id. Unknown tokens are ignored: signing out always "works". */
export async function endSession(options: { refreshToken?: string; sessionId?: string }) {
  if (options.refreshToken) {
    const session = await sessionRepository.findByTokenHash(sha256(options.refreshToken));
    if (session) {
      await sessionRepository.revoke(session._id, SESSION_REVOKE_REASON.LOGOUT);
      await denySession(String(session._id));
    }
  }
  if (options.sessionId) {
    await sessionRepository.revoke(options.sessionId, SESSION_REVOKE_REASON.LOGOUT);
    await denySession(options.sessionId);
  }
}

/** Sign out everywhere, optionally keeping one session (used after a password change, which re-issues that one's tokens). */
export async function endAllSessions(userId: string, reason: string, keepSessionId?: string) {
  await sessionRepository.revokeAllForUser(userId, reason, keepSessionId);
  // Access tokens already in the wild are told to stop by time, not one by one.
  await denyAllIssuedBefore(userId);
}

export async function listSessions(userId: string, currentSessionId?: string) {
  const sessions = await sessionRepository.listActive(userId);
  return sessions.map((s) => ({ id: String(s._id), ip: s.ip, userAgent: s.userAgent, createdAt: s.createdAt, lastUsedAt: s.lastUsedAt, current: String(s._id) === currentSessionId }));
}

export async function revokeSessionById(userId: string, id: string) {
  const session = await sessionRepository.findOwned(userId, id);
  if (!session) throw HttpError.notFound(ERROR_MESSAGE.SESSION_NOT_FOUND);
  await sessionRepository.revoke(session._id, SESSION_REVOKE_REASON.REVOKED_BY_USER);
  await denySession(String(session._id));
  securityLog(SECURITY_EVENT.SESSION_REVOKED, { userId, sessionId: id });
}

/** New tokens for a session that stays signed in (after a password change, when every access token was just invalidated). */
export async function reissueTokens(sessionId: string, client: ClientInfo): Promise<IssuedTokens> {
  const session = await sessionRepository.findById(sessionId);
  if (!session) throw HttpError.unauthorized(ERROR_MESSAGE.REFRESH_INVALID);
  const refreshToken = newRefreshToken();
  const rotated = await sessionRepository.rotate(session._id, session.tokenHash, { tokenHash: sha256(refreshToken), expiresAt: nextExpiry(session.absoluteExpiresAt), ...clean(client) });
  if (!rotated) throw HttpError.unauthorized(ERROR_MESSAGE.REFRESH_INVALID);
  return { accessToken: signAccessToken(String(rotated.user), String(rotated._id)), refreshToken, refreshExpiresAt: rotated.expiresAt, sessionId: String(rotated._id) };
}
