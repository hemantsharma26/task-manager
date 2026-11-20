import type { RequestHandler } from 'express';
import { CONTENT_TYPE_JSON, ERROR_MESSAGE, HEADER, METHODS_WITH_BODY, SECURITY_EVENT, UPLOAD } from '../../constants/index.js';
import { securityLog } from '../../infra/security-log.js';
import { HttpError } from '../errors/http-error.js';

/**
 * A request that carries a body must say it is JSON. This closes a classic CSRF route: a plain HTML <form> can only
 * send form or text content types, never application/json, and a cross-site script cannot add that header without
 * a CORS pre-flight that this API refuses.
 */
export const requireJson: RequestHandler = (req, _res, next) => {
  if (!METHODS_WITH_BODY.includes(req.method)) return next();
  // The one place a non-JSON body is expected: a file upload (multipart) to an attachments URL. It is checked again by the
  // upload code itself (real file type, size, count), and the cross-site origin check still applies to it.
  if (UPLOAD.PATH_PATTERN.test(req.path) && req.is('multipart/form-data')) return next();
  const hasBody = Number(req.get('content-length') ?? 0) > 0 || req.get('transfer-encoding') !== undefined;
  if (hasBody && !req.is(CONTENT_TYPE_JSON)) {
    securityLog(SECURITY_EVENT.NON_JSON_BLOCKED, { path: req.path, contentType: req.get(HEADER.CONTENT_TYPE), ip: req.ip });
    return next(HttpError.unsupportedMediaType(ERROR_MESSAGE.JSON_REQUIRED));
  }
  next();
};
