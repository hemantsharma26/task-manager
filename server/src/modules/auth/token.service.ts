import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ERROR_MESSAGE, TIME, TOKEN } from '../../constants/index.js';
import { HttpError } from '../../shared/errors/http-error.js';

export interface AccessClaims {
  userId: string;
  sessionId: string;
  /** Issue time in milliseconds. "Everything issued before T is invalid" is checked against this. */
  issuedAtMs: number;
}

/** A short-lived signed token that says who is calling and from which session. Nothing secret is inside it. */
export function signAccessToken(userId: string, sessionId: string): string {
  return jwt.sign({ sid: sessionId, ts: Date.now() }, env.JWT_SECRET, {
    algorithm: TOKEN.ALGORITHM,
    subject: userId,
    issuer: TOKEN.ISSUER,
    audience: TOKEN.AUDIENCE,
    expiresIn: env.ACCESS_TOKEN_MINUTES * 60,
  });
}

export const accessTokenLifetimeSeconds = () => env.ACCESS_TOKEN_MINUTES * (TIME.MINUTE_MS / TIME.SECOND_MS);

export function verifyAccessToken(token: string): AccessClaims {
  try {
    // The algorithm is pinned: a token claiming "alg: none", or one signed with a different algorithm, is rejected
    // instead of being trusted because it says so itself.
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: [TOKEN.ALGORITHM], issuer: TOKEN.ISSUER, audience: TOKEN.AUDIENCE });
    if (typeof payload === 'string' || !payload.sub || typeof payload.sid !== 'string' || typeof payload.ts !== 'number') {
      throw new Error(ERROR_MESSAGE.MALFORMED_TOKEN);
    }
    return { userId: payload.sub, sessionId: payload.sid, issuedAtMs: payload.ts };
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) throw HttpError.tokenExpired(ERROR_MESSAGE.ACCESS_TOKEN_EXPIRED);
    throw HttpError.unauthorized(ERROR_MESSAGE.SESSION_EXPIRED);
  }
}
