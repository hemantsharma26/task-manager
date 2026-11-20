import type { RequestHandler } from 'express';
import { verifyToken } from '../services/auth.service.js';
import { HttpError } from '../utils/httpError.js';

export const AUTH_COOKIE = 'tm_token';

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
    next(HttpError.unauthorized('Session expired, please sign in again'));
  }
};
