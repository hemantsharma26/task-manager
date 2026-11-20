import type { RequestHandler } from 'express';
import { ERROR_MESSAGE, SECURITY_EVENT } from '../../constants/index.js';
import { securityLog } from '../../infra/security-log.js';
import { HttpError } from '../errors/http-error.js';

// Keys no honest client of this API ever sends:
//   "$ne", "$gt", "$where" ...  MongoDB operators, the ingredients of NoSQL injection ({"password": {"$ne": ""}})
//   "a.b"                       dotted paths, which MongoDB reads as "reach into a nested field"
//   "a[$ne]", "a[b]"             bracket syntax, which query-string parsers turn into nested objects
//   "__proto__", "constructor"  the ingredients of prototype pollution
const FORBIDDEN_KEY = /^\$|[.[\]]/;
const PROTOTYPE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 8;

function hasForbiddenKey(value: unknown, depth = 0): boolean {
  if (depth > MAX_DEPTH) return true; // absurdly deep input is not a real request
  if (Array.isArray(value)) return value.some((v) => hasForbiddenKey(v, depth + 1));
  if (value && typeof value === 'object') {
    return Object.keys(value).some((k) => FORBIDDEN_KEY.test(k) || PROTOTYPE_KEYS.has(k) || hasForbiddenKey((value as Record<string, unknown>)[k], depth + 1));
  }
  return false;
}

/**
 * Input is also validated field by field (zod only accepts plain strings, numbers and so on), so this is a second
 * layer: the request is refused outright, before it can reach any code that builds a database query from it.
 */
export const rejectOperatorKeys: RequestHandler = (req, _res, next) => {
  if (hasForbiddenKey(req.body) || hasForbiddenKey(req.query) || hasForbiddenKey(req.params)) {
    securityLog(SECURITY_EVENT.OPERATOR_KEYS_BLOCKED, { path: req.path, ip: req.ip });
    return next(HttpError.badRequest(ERROR_MESSAGE.FORBIDDEN_KEYS));
  }
  next();
};
