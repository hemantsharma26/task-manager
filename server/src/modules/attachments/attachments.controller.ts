import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { ERROR_MESSAGE, FILE_CSP, HEADER, HTTP_STATUS, ATTACHMENT_KIND, ROUTE_PARAM, UPLOAD } from '../../constants/index.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { toTaskDTO } from '../tasks/tasks.mapper.js';
import * as attachments from './attachments.service.js';
import { multerUpload } from './attachments.storage.js';

const taskIdOf = (req: Request) => String(req.params[ROUTE_PARAM.ID]);

/** multer's own failures (too big, too many, an unexpected field) become the same clean errors as everything else. */
export function receiveFiles(req: Request, res: Response, next: NextFunction) {
  multerUpload.array(UPLOAD.FIELD, UPLOAD.MAX_FILES_PER_REQUEST)(req, res, (err: unknown) => {
    if (!err) return next();
    // A broken multipart body (a bad part header, a truncated upload) is the sender's mistake, so it answers 400. Only real
    // server trouble, such as a full or unwritable disk (error codes like ENOSPC), is allowed to become a 500.
    if (!(err instanceof multer.MulterError)) {
      const code = (err as { code?: string }).code;
      return next(typeof code === 'string' && /^E[A-Z]+$/.test(code) ? err : HttpError.badRequest(ERROR_MESSAGE.MALFORMED_REQUEST));
    }
    if (err.code === 'LIMIT_FILE_SIZE') return next(new HttpError(HTTP_STATUS.PAYLOAD_TOO_LARGE, ERROR_MESSAGE.BODY_TOO_LARGE, 'PAYLOAD_TOO_LARGE'));
    if (err.code === 'LIMIT_FILE_COUNT' || err.code === 'LIMIT_UNEXPECTED_FILE') return next(HttpError.badRequest(ERROR_MESSAGE.TOO_MANY_FILES_AT_ONCE(UPLOAD.MAX_FILES_PER_REQUEST)));
    next(HttpError.badRequest(ERROR_MESSAGE.MALFORMED_REQUEST));
  });
}

export async function upload(req: Request, res: Response) {
  const task = await attachments.addAttachments(req.userId!, taskIdOf(req), (req.files as Express.Multer.File[] | undefined) ?? []);
  res.status(HTTP_STATUS.CREATED).json({ task: toTaskDTO(task) });
}

export async function remove(req: Request, res: Response) {
  const task = await attachments.removeAttachment(req.userId!, taskIdOf(req), String(req.params[ROUTE_PARAM.ATTACHMENT_ID]));
  res.json({ task: toTaskDTO(task) });
}

/** RFC 5987 filename: an ASCII fallback plus the real UTF-8 name, with quotes and backslashes made harmless. */
const disposition = (name: string) => `inline; filename="${name.replace(/[^\x20-\x7e]|["\\]/g, '_')}"; filename*=UTF-8''${encodeURIComponent(name)}`;

export async function download(req: Request, res: Response) {
  const file = await attachments.locateAttachment(req.userId!, taskIdOf(req), String(req.params[ROUTE_PARAM.ATTACHMENT_ID]));
  res.set({
    [HEADER.CACHE_CONTROL]: `private, max-age=${UPLOAD.CACHE_SECONDS}`,
    // Served as the type it really is, and the browser may not guess a different one.
    'Content-Type': file.mime,
    'X-Content-Type-Options': 'nosniff',
    'Content-Disposition': disposition(file.name),
  });
  // Images and video may not load anything else. A PDF needs the browser's own viewer, which a restrictive policy would block;
  // it is still never HTML, and `nosniff` stops it being treated as such.
  if (file.kind === ATTACHMENT_KIND.PDF) res.removeHeader('Content-Security-Policy');
  else res.set('Content-Security-Policy', FILE_CSP);
  // sendFile answers Range requests, which is what lets a video be played and scrubbed without downloading all of it.
  res.sendFile(file.filePath, { dotfiles: 'deny', acceptRanges: true, cacheControl: false, headers: {} });
}

