import { randomUUID } from 'node:crypto';
import { promises as fs, mkdirSync } from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { uploadDir } from '../../config/env.js';
import { UPLOAD } from '../../constants/index.js';

// Files are kept at  <UPLOAD_DIR>/<owner id>/<random uuid>  and nowhere else. The uuid is made here, so nothing the user
// sends (not the file name, not a path) ever becomes part of a path on disk.
const STORED_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const ownerDir = (ownerId: string) => path.join(uploadDir, ownerId);

/** The path of a stored file, refusing anything that is not exactly an id we generated. */
export function storedPath(ownerId: string, storedName: string): string {
  if (!STORED_NAME.test(storedName) || !/^[0-9a-f]{24}$/.test(ownerId)) throw new Error('Invalid stored file reference');
  return path.join(ownerDir(ownerId), storedName);
}

export const multerUpload = multer({
  storage: multer.diskStorage({
    destination: (req, _file, cb) => {
      const dir = ownerDir(String(req.userId));
      mkdirSync(dir, { recursive: true });
      cb(null, dir);
    },
    filename: (_req, _file, cb) => cb(null, randomUUID()),
  }),
  limits: { fileSize: UPLOAD.HARD_MAX_BYTES, files: UPLOAD.MAX_FILES_PER_REQUEST, fields: 0, parts: UPLOAD.MAX_FILES_PER_REQUEST },
});

/** Deletes stored files, ignoring ones that are already gone. */
export async function removeStoredFiles(ownerId: string, storedNames: string[]) {
  await Promise.all(storedNames.map((name) => fs.rm(storedPath(ownerId, name), { force: true }).catch(() => undefined)));
}
