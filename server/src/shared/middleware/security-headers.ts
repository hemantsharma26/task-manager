import type { RequestHandler } from 'express';
import helmet from 'helmet';
import { hstsEnabled } from '../../config/env.js';
import { CSP_DIRECTIVES, HEADER, HSTS, PERMISSIONS_POLICY } from '../../constants/index.js';

/**
 * The response headers that tell the browser how much to trust the page:
 *  - Content-Security-Policy: only our own origin may run scripts, load styles or connect (the main XSS defence)
 *  - frame-ancestors none / X-Frame-Options DENY: the app cannot be embedded in another site (clickjacking)
 *  - X-Content-Type-Options nosniff, Referrer-Policy no-referrer, Cross-Origin-* policies, and a locked-down Permissions-Policy
 *  - HSTS only when asked for: it belongs to whatever terminates TLS, and sending it over plain http breaks local use
 */
export const securityHeaders: RequestHandler[] = [
  helmet({
    contentSecurityPolicy: { useDefaults: false, directives: { ...CSP_DIRECTIVES, upgradeInsecureRequests: null } },
    referrerPolicy: { policy: 'no-referrer' },
    frameguard: { action: 'deny' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    strictTransportSecurity: hstsEnabled ? { maxAge: HSTS.MAX_AGE_SECONDS, includeSubDomains: HSTS.INCLUDE_SUBDOMAINS } : false,
  }),
  (_req, res, next) => {
    res.setHeader(HEADER.PERMISSIONS_POLICY, PERMISSIONS_POLICY);
    next();
  },
];
