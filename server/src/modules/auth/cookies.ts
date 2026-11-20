import type { CookieOptions, Request, Response } from 'express';
import { cookieSecure, env } from '../../config/env.js';
import { COOKIE, COOKIE_BASE, COOKIE_PREFIX, TIME } from '../../constants/index.js';

// In production the cookie names carry a prefix the BROWSER enforces: __Host- cookies must be Secure, sit at Path=/
// and can never carry a Domain, so another subdomain cannot plant or overwrite them. The refresh cookie lives on a
// narrower path, which __Host- does not allow, so it uses __Secure-.
export const accessCookieName = () => (cookieSecure ? COOKIE_PREFIX.HOST : '') + COOKIE_BASE.ACCESS;
export const refreshCookieName = () => (cookieSecure ? COOKIE_PREFIX.SECURE : '') + COOKIE_BASE.REFRESH;

const base = (): CookieOptions => ({
  httpOnly: true, // not readable from JavaScript, so an XSS bug cannot steal a token
  secure: cookieSecure,
});

const accessOptions = (): CookieOptions => ({ ...base(), sameSite: COOKIE.SAME_SITE_LAX, path: COOKIE.PATH_ALL });
// Strict: the refresh cookie is not even sent when arriving from another site. Path: only the auth routes see it.
const refreshOptions = (): CookieOptions => ({ ...base(), sameSite: COOKIE.SAME_SITE_STRICT, path: COOKIE.PATH_REFRESH });

export function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string; refreshExpiresAt: Date }) {
  res.cookie(accessCookieName(), tokens.accessToken, { ...accessOptions(), maxAge: env.ACCESS_TOKEN_MINUTES * TIME.MINUTE_MS });
  res.cookie(refreshCookieName(), tokens.refreshToken, { ...refreshOptions(), expires: tokens.refreshExpiresAt });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(accessCookieName(), accessOptions());
  res.clearCookie(refreshCookieName(), refreshOptions());
}

export const readAccessCookie = (req: Request) => req.cookies?.[accessCookieName()] as string | undefined;
export const readRefreshCookie = (req: Request) => req.cookies?.[refreshCookieName()] as string | undefined;
