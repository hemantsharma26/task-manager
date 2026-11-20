import type { Request, Response } from 'express';
import { CACHE_CONTROL, HEADER, HTTP_STATUS, ROUTE_PARAM } from '../../constants/index.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { ERROR_MESSAGE } from '../../constants/index.js';
import { toUserDTO } from './auth.mapper.js';
import { changePasswordSchema, loginSchema, registerSchema } from './auth.schemas.js';
import * as auth from './auth.service.js';
import { clearAuthCookies, readAccessCookie, readRefreshCookie, setAuthCookies } from './cookies.js';
import * as sessions from './session.service.js';
import { verifyAccessToken } from './token.service.js';

const clientOf = (req: Request) => ({ ip: req.ip ?? '', userAgent: req.get(HEADER.USER_AGENT) ?? '' });

/** Auth responses carry account data and credentials: no browser, proxy or CDN may keep a copy. */
export function noStore(_req: Request, res: Response, next: () => void) {
  res.set(HEADER.CACHE_CONTROL, CACHE_CONTROL.NO_STORE);
  next();
}

export async function register(req: Request, res: Response) {
  const { user, tokens } = await auth.register(registerSchema.parse(req.body), clientOf(req));
  setAuthCookies(res, tokens);
  res.status(HTTP_STATUS.CREATED).json({ user: toUserDTO(user) });
}

export async function login(req: Request, res: Response) {
  const { user, tokens } = await auth.login(loginSchema.parse(req.body), clientOf(req));
  setAuthCookies(res, tokens);
  res.json({ user: toUserDTO(user) });
}

/** Called by the browser (automatically, by the client) when the short-lived access token has run out. */
export async function refresh(req: Request, res: Response) {
  const presented = readRefreshCookie(req);
  if (!presented) throw HttpError.unauthorized(ERROR_MESSAGE.REFRESH_INVALID);
  try {
    const { userId, ...tokens } = await sessions.refreshSession(presented, clientOf(req));
    setAuthCookies(res, tokens);
    res.json({ user: toUserDTO(await auth.currentUser(userId)) });
  } catch (err) {
    // A refresh token that does not work is useless: drop both cookies so the browser stops sending it.
    clearAuthCookies(res);
    throw err;
  }
}

/** Always succeeds from the caller's point of view, even with expired or missing cookies. */
export async function logout(req: Request, res: Response) {
  let sessionId: string | undefined;
  try {
    const access = readAccessCookie(req);
    if (access) sessionId = verifyAccessToken(access).sessionId;
  } catch {
    /* an expired access token is fine: the refresh cookie identifies the session too */
  }
  await sessions.endSession({ refreshToken: readRefreshCookie(req), sessionId });
  clearAuthCookies(res);
  res.status(HTTP_STATUS.NO_CONTENT).end();
}

export async function logoutAll(req: Request, res: Response) {
  await auth.signOutEverywhere(req.userId!, req.ip ?? '');
  clearAuthCookies(res);
  res.status(HTTP_STATUS.NO_CONTENT).end();
}

export async function me(req: Request, res: Response) {
  res.json({ user: toUserDTO(await auth.currentUser(req.userId!)) });
}

export async function changePassword(req: Request, res: Response) {
  const client = clientOf(req);
  const user = await auth.changePassword(req.userId!, req.sessionId!, changePasswordSchema.parse(req.body), client);
  // Every access token was just invalidated, including this one, so hand the caller a fresh pair.
  setAuthCookies(res, await sessions.reissueTokens(req.sessionId!, client));
  res.json({ user: toUserDTO(user) });
}

export async function listSessions(req: Request, res: Response) {
  res.json({ sessions: await sessions.listSessions(req.userId!, req.sessionId) });
}

export async function revokeSession(req: Request, res: Response) {
  await sessions.revokeSessionById(req.userId!, String(req.params[ROUTE_PARAM.ID]));
  res.status(HTTP_STATUS.NO_CONTENT).end();
}
