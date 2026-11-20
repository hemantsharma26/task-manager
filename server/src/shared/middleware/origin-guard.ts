import type { RequestHandler } from 'express';
import { allowedOrigins, env, isProd } from '../../config/env.js';
import { ERROR_MESSAGE, HEADER, SAFE_METHODS, SEC_FETCH_SITE, SECURITY_EVENT } from '../../constants/index.js';
import { securityLog } from '../../infra/security-log.js';
import { HttpError } from '../errors/http-error.js';

/**
 * CSRF defence for cookie-authenticated requests, on top of SameSite cookies and JSON-only bodies.
 *
 * Browsers attach an Origin header (and Sec-Fetch-Site) to every cross-site write. A write that says it comes from
 * another site is refused, however valid the cookies on it are. Requests with neither header (curl, server-to-server,
 * tests) cannot be forged by a web page, so they pass.
 */
export const originGuard: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.includes(req.method)) return next();

  const origin = req.get(HEADER.ORIGIN);
  const fetchSite = req.get(HEADER.SEC_FETCH_SITE);
  if (!origin && !fetchSite) return next();

  const trusted = new Set<string>([`${req.protocol}://${req.get('host')}`, ...allowedOrigins]);
  if (!isProd) trusted.add(env.CLIENT_ORIGIN);

  const originOk = origin ? trusted.has(origin) : true;
  const siteOk = fetchSite ? fetchSite !== SEC_FETCH_SITE.CROSS_SITE || (!!origin && trusted.has(origin)) : true;

  if (originOk && siteOk) return next();
  securityLog(SECURITY_EVENT.ORIGIN_BLOCKED, { origin, fetchSite, path: req.path, ip: req.ip });
  next(HttpError.forbidden(ERROR_MESSAGE.CROSS_ORIGIN_BLOCKED));
};
