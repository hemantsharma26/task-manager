import type { Request, Response } from 'express';
import { CACHE_CONTROL, HEADER, HTTP_STATUS, ROUTE_PARAM } from '../../constants/index.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { ERROR_MESSAGE } from '../../constants/index.js';
import { toUserDTO } from './auth.mapper.js';
import { changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from './auth.schemas.js';
import * as passwordReset from './password-reset.service.js';
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

/** Every device except this one. Their access tokens die at once, so this one is handed a fresh pair. */
export async function logoutOthers(req: Request, res: Response) {
  await auth.signOutOthers(req.userId!, req.sessionId!, req.ip ?? '');
  setAuthCookies(res, await sessions.reissueTokens(req.sessionId!, clientOf(req)));
  res.status(HTTP_STATUS.NO_CONTENT).end();
}

/** Same answer for every address, so it cannot be used to find out who has an account. */
export async function forgotPassword(req: Request, res: Response) {
  await passwordReset.requestPasswordReset(forgotPasswordSchema.parse(req.body).email, clientOf(req));
  res.status(HTTP_STATUS.ACCEPTED).json({ ok: true });
}

export async function resetPassword(req: Request, res: Response) {
  const { token, newPassword } = resetPasswordSchema.parse(req.body);
  await passwordReset.resetPassword(token, newPassword, clientOf(req));
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
