import { ERROR_CODE, ERROR_MESSAGE, HTTP_STATUS } from '../../constants/index.js';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = ERROR_CODE.ERROR,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }

  static badRequest(message: string, details?: unknown) {
    return new HttpError(HTTP_STATUS.BAD_REQUEST, message, ERROR_CODE.BAD_REQUEST, details);
  }
  static unauthorized(message: string = ERROR_MESSAGE.AUTH_REQUIRED) {
    return new HttpError(HTTP_STATUS.UNAUTHORIZED, message, ERROR_CODE.UNAUTHORIZED);
  }
  static notFound(message: string = ERROR_MESSAGE.RESOURCE_NOT_FOUND) {
    return new HttpError(HTTP_STATUS.NOT_FOUND, message, ERROR_CODE.NOT_FOUND);
  }
  static conflict(message: string) {
    return new HttpError(HTTP_STATUS.CONFLICT, message, ERROR_CODE.CONFLICT);
  }
}
