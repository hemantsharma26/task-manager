import type { RequestHandler } from 'express';
import { CACHE_CONTROL, HEADER, HTTP_METHOD, ROUTE } from '../../constants/index.js';

// API responses are per-user, so shared caches (CDN, proxy) must never keep them. "no-cache" does not mean
// "do not cache": the browser may store the response but must revalidate every time. Express adds an ETag
// to each JSON body, so an unchanged list comes back as an empty 304 instead of the full payload.
export const apiCacheHeaders: RequestHandler = (req, res, next) => {
  if (req.method === HTTP_METHOD.GET && req.path !== ROUTE.HEALTH) {
    res.set(HEADER.CACHE_CONTROL, CACHE_CONTROL.PRIVATE_REVALIDATE);
    res.vary(HEADER.VARY_COOKIE);
  }
  next();
};
