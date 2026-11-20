import type { RequestHandler } from 'express';
import { AUTH_COOKIE, ERROR_MESSAGE } from '../../constants/index.js';
import { verifyToken } from '../../modules/auth/token.service.js';
import { HttpError } from '../errors/http-error.js';

declare module 'express-serve-static-core' {
  interface Request {
    userId?: string;
  }
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  const token = req.cookies?.[AUTH_COOKIE] as string | undefined;
  if (!token) return next(HttpError.unauthorized());
  try {
    req.userId = verifyToken(token);
    next();
  } catch {
    next(HttpError.unauthorized(ERROR_MESSAGE.SESSION_EXPIRED));
  }
};
