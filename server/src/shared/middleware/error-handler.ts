import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { ERROR_CODE, ERROR_MESSAGE, HEADER, HTTP_STATUS, LOG_MESSAGE } from '../../constants/index.js';
import { logger } from '../../infra/logger.js';
import { HttpError } from '../errors/http-error.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(HttpError.notFound(ERROR_MESSAGE.ROUTE_NOT_FOUND(req.method, req.originalUrl)));
};

// Every error leaves the API in one shape: { error: { code, message, details? } }
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(HTTP_STATUS.BAD_REQUEST).json({
      error: {
        code: ERROR_CODE.VALIDATION_ERROR,
        message: ERROR_MESSAGE.VALIDATION_FAILED,
        details: err.issues.map((i) => ({ field: i.path.join('.'), message: i.message })),
      },
    });
    return;
  }

  if (err instanceof HttpError) {
    if (err.retryAfterSeconds) res.set(HEADER.RETRY_AFTER, String(err.retryAfterSeconds));
    res.status(err.status).json({
      error: { code: err.code, message: err.message, ...(err.details !== undefined && { details: err.details }) },
    });
    return;
  }

  // express.json() failures (malformed JSON, body too large)
  const status = (err as { status?: number }).status;
  if (status && status >= HTTP_STATUS.BAD_REQUEST && status < HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    res.status(status).json({
      error: {
        code: ERROR_CODE.BAD_REQUEST,
        message: status === HTTP_STATUS.PAYLOAD_TOO_LARGE ? ERROR_MESSAGE.BODY_TOO_LARGE : ERROR_MESSAGE.MALFORMED_REQUEST,
      },
    });
    return;
  }

  logger.error({ err, method: req.method, url: req.originalUrl }, LOG_MESSAGE.UNHANDLED_ERROR);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: { code: ERROR_CODE.INTERNAL, message: ERROR_MESSAGE.INTERNAL } });
};
