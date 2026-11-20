import { Router, type Response } from 'express';
import rateLimit from 'express-rate-limit';
import { cookieSecure, env } from '../config/env.js';
import { AUTH_COOKIE, requireAuth } from '../middleware/auth.js';
import { User, toUserDTO } from '../models/User.js';
import { loginSchema, registerSchema } from '../schemas/auth.js';
import * as auth from '../services/auth.service.js';
import { HttpError } from '../utils/httpError.js';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function setSessionCookie(res: Response, userId: string) {
  res.cookie(AUTH_COOKIE, auth.signToken(userId), {
    httpOnly: true, // not readable from JS, so an XSS bug cannot steal the token
    sameSite: 'lax', // not sent on cross-site POSTs, which covers CSRF for this JSON API
    secure: cookieSecure,
    maxAge: 7 * ONE_DAY_MS,
    path: '/',
  });
}

// Slows down password guessing. Skipped in tests so they can sign in freely.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: () => env.NODE_ENV === 'test',
  message: { error: { code: 'RATE_LIMITED', message: 'Too many attempts, try again in a few minutes' } },
});

export const authRouter = Router();

authRouter.post('/register', authLimiter, async (req, res) => {
  const input = registerSchema.parse(req.body);
  const user = await auth.register(input);
  setSessionCookie(res, String(user._id));
  res.status(201).json({ user: toUserDTO(user) });
});

authRouter.post('/login', authLimiter, async (req, res) => {
  const input = loginSchema.parse(req.body);
  const user = await auth.login(input);
  setSessionCookie(res, String(user._id));
  res.json({ user: toUserDTO(user) });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(AUTH_COOKIE, { path: '/' });
  res.status(204).end();
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const user = await User.findById(req.userId);
  if (!user) throw HttpError.unauthorized('Account no longer exists');
  res.json({ user: toUserDTO(user) });
});
