import rateLimit from 'express-rate-limit';
import { env, isTest } from '../../config/env.js';
import { ERROR_CODE, ERROR_MESSAGE, RATE_LIMIT_HEADERS_DRAFT, ROUTE } from '../../constants/index.js';

const rateLimited = (message: string) => ({ error: { code: ERROR_CODE.RATE_LIMITED, message } });

/** A generous ceiling per client for the whole API. */
export const apiRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_API_WINDOW_SECONDS * 1000,
  limit: env.RATE_LIMIT_API_MAX,
  standardHeaders: RATE_LIMIT_HEADERS_DRAFT,
  legacyHeaders: false,
  skip: (req) => isTest || req.path === ROUTE.HEALTH,
  message: rateLimited(ERROR_MESSAGE.TOO_MANY_REQUESTS),
});

/** Much stricter, for sign in and register: slows down password guessing. */
export const authRateLimit = rateLimit({
  windowMs: env.RATE_LIMIT_AUTH_WINDOW_SECONDS * 1000,
  limit: env.RATE_LIMIT_AUTH_MAX,
  standardHeaders: RATE_LIMIT_HEADERS_DRAFT,
  legacyHeaders: false,
  skip: () => isTest,
  message: rateLimited(ERROR_MESSAGE.TOO_MANY_AUTH_ATTEMPTS),
});
