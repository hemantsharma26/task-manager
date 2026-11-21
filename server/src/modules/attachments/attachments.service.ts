import { promises as fs } from 'node:fs';
import { fileTypeFromFile } from 'file-type';
import { ALLOWED_FILE_TYPES, ERROR_MESSAGE, PATTERN, UPLOAD, type AttachmentKind } from '../../constants/index.js';
import { cache } from '../../infra/cache/index.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { taskRepository } from '../tasks/tasks.repository.js';
import { removeStoredFiles, storedPath } from './attachments.storage.js';

/** The name shown to people: no folders, no control characters, bounded length. Never used as a path. */
export function displayName(original: string): string {
  const base = original.replace(/\\/g, '/').split('/').pop() ?? '';
  const cleaned = base.replace(PATTERN.CONTROL_CHARS, '').replace(/\s+/g, ' ').trim().slice(0, UPLOAD.NAME_MAX_LENGTH);
  return cleaned || 'file';
}

interface Checked {
  file: Express.Multer.File;
  mime: string;
  kind: AttachmentKind;
}

/** What a file REALLY is: read from its first bytes, ignoring its name and what the browser claimed. */
async function inspect(file: Express.Multer.File): Promise<Checked> {
  const type = await fileTypeFromFile(file.path).catch(() => undefined);
  const kind = type ? ALLOWED_FILE_TYPES[type.mime] : undefined;
  if (!type || !kind) throw HttpError.badRequest(ERROR_MESSAGE.FILE_TYPE_NOT_ALLOWED(displayName(file.originalname)));
  const max = UPLOAD.MAX_BYTES[kind];
  if (file.size > max) throw HttpError.badRequest(ERROR_MESSAGE.FILE_TOO_LARGE(displayName(file.originalname), UPLOAD.KIND_LABEL[kind], max / (1024 * 1024)));
  return { file, mime: type.mime, kind };
}

/**
 * Attach the uploaded files to a task. All or nothing: if one file is refused, none is kept (and nothing is left on disk).
 * By the time this runs multer has already written the files, so every failure path must delete them.
 */
export async function addAttachments(userId: string, taskId: string, files: Express.Multer.File[]) {
  const discard = () => removeStoredFiles(userId, files.map((f) => f.filename));
  try {
    if (files.length === 0) throw HttpError.badRequest(ERROR_MESSAGE.NO_FILES);
    const task = await taskRepository.findOwned(userId, taskId);
    if (!task) throw HttpError.notFound(ERROR_MESSAGE.TASK_NOT_FOUND);
    if (task.attachments.length + files.length > UPLOAD.MAX_FILES_PER_TASK) throw HttpError.badRequest(ERROR_MESSAGE.TOO_MANY_FILES_ON_TASK(UPLOAD.MAX_FILES_PER_TASK));

    const checked = await Promise.all(files.map(inspect));
    for (const c of checked) {
      task.attachments.push({ name: displayName(c.file.originalname), mime: c.mime, kind: c.kind, size: c.file.size, storedName: c.file.filename } as never);
    }
    await task.save();
    await cache.invalidateUser(userId);
    return task;
  } catch (err) {
    await discard();
    throw err;
  }
}

export async function removeAttachment(userId: string, taskId: string, attachmentId: string) {
  const task = await taskRepository.findOwned(userId, taskId);
  const attachment = task?.attachments.find((a) => String(a._id) === attachmentId);
  if (!task || !attachment) throw HttpError.notFound(ERROR_MESSAGE.ATTACHMENT_NOT_FOUND);
  task.attachments = task.attachments.filter((a) => String(a._id) !== attachmentId) as typeof task.attachments;
  await task.save();
  await removeStoredFiles(userId, [attachment.storedName]);
  await cache.invalidateUser(userId);
  return task;
}

/** Where a file is, and what it is, once the caller has been shown to own the task. */
export async function locateAttachment(userId: string, taskId: string, attachmentId: string) {
  const task = await taskRepository.findOwned(userId, taskId);
  const attachment = task?.attachments.find((a) => String(a._id) === attachmentId);
  if (!attachment) throw HttpError.notFound(ERROR_MESSAGE.ATTACHMENT_NOT_FOUND);
  const filePath = storedPath(userId, attachment.storedName);
  // The database may say a file exists that was lost from disk (a restored backup, a deleted folder): a clean 404.
  await fs.access(filePath).catch(() => {
    throw HttpError.notFound(ERROR_MESSAGE.ATTACHMENT_NOT_FOUND);
  });
  return { filePath, mime: attachment.mime, kind: attachment.kind, name: attachment.name };
}
