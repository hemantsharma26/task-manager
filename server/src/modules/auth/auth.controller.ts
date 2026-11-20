import type { Request, Response } from 'express';
import { cookieSecure, env } from '../../config/env.js';
import { AUTH_COOKIE, COOKIE, HTTP_STATUS, SESSION } from '../../constants/index.js';
import { loginSchema, registerSchema } from './auth.schemas.js';
import { toUserDTO } from './auth.mapper.js';
import * as auth from './auth.service.js';
import { signToken } from './token.service.js';

function setSessionCookie(res: Response, userId: string) {
  res.cookie(AUTH_COOKIE, signToken(userId), {
    httpOnly: true, // not readable from JS, so an XSS bug cannot steal the token
    sameSite: COOKIE.SAME_SITE, // not sent on cross-site POSTs, which covers CSRF for this JSON API
    secure: cookieSecure,
    maxAge: env.SESSION_COOKIE_DAYS * SESSION.ONE_DAY_MS,
    path: COOKIE.PATH,
  });
}

export async function register(req: Request, res: Response) {
  const user = await auth.register(registerSchema.parse(req.body));
  setSessionCookie(res, String(user._id));
  res.status(HTTP_STATUS.CREATED).json({ user: toUserDTO(user) });
}

export async function login(req: Request, res: Response) {
  const user = await auth.login(loginSchema.parse(req.body));
  setSessionCookie(res, String(user._id));
  res.json({ user: toUserDTO(user) });
}

export function logout(_req: Request, res: Response) {
  res.clearCookie(AUTH_COOKIE, { path: COOKIE.PATH });
  res.status(HTTP_STATUS.NO_CONTENT).end();
}

export async function me(req: Request, res: Response) {
  res.json({ user: toUserDTO(await auth.currentUser(req.userId!)) });
}
