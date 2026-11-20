import type { RequestHandler } from 'express';
import { readAccessCookie } from '../../modules/auth/cookies.js';
import { isRevoked } from '../../modules/auth/revocation.service.js';
import { verifyAccessToken } from '../../modules/auth/token.service.js';
import { HttpError } from '../errors/http-error.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
    sessionId?: string;
  }
}

/**
 * Lets a request through only with a valid, signed, unexpired access token whose session has not been revoked.
 * An expired token answers 401 with code TOKEN_EXPIRED, which is the signal for the client to refresh quietly.
 */
export const requireAuth: RequestHandler = async (req, _res, next) => {
  try {
    const token = readAccessCookie(req);
    if (!token) throw HttpError.unauthorized();
    const claims = verifyAccessToken(token);
    if (await isRevoked(claims)) throw HttpError.unauthorized();
    req.userId = claims.userId;
    req.sessionId = claims.sessionId;
    next();
  } catch (err) {
    next(err);
  }
};

