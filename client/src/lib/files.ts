import type { AttachmentKind } from '../api/types';

const MB = 1024 * 1024;

// The same rules the server enforces (it is the authority: it reads the real file type from the file's first bytes). These
// run in the browser so a wrong or oversized file is explained straight away, before anything is uploaded.
export const MAX_FILES_PER_UPLOAD = 5;
export const MAX_FILES_PER_TASK = 20;
export const MAX_BYTES: Record<AttachmentKind, number> = { image: 10 * MB, pdf: 25 * MB, video: 100 * MB };
export const ACCEPT = 'image/png,image/jpeg,image/gif,image/webp,video/mp4,video/webm,video/quicktime,application/pdf';

const KIND_BY_TYPE: Record<string, AttachmentKind> = {
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/gif': 'image',
  'image/webp': 'image',
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
  'application/pdf': 'pdf',
};
const KIND_BY_EXTENSION: Record<string, AttachmentKind> = { png: 'image', jpg: 'image', jpeg: 'image', gif: 'image', webp: 'image', mp4: 'video', webm: 'video', mov: 'video', pdf: 'pdf' };
const LABEL: Record<AttachmentKind, string> = { image: 'image', video: 'video', pdf: 'PDF' };

export function kindOf(file: { name: string; type: string }): AttachmentKind | undefined {
  return KIND_BY_TYPE[file.type] ?? KIND_BY_EXTENSION[file.name.split('.').pop()?.toLowerCase() ?? ''];
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / MB).toFixed(bytes < 10 * MB ? 1 : 0)} MB`;
}

/** Returns what is wrong with a file, or null if it can be uploaded. */
export function problemWith(file: { name: string; type: string; size: number }): string | null {
  const kind = kindOf(file);
  if (!kind) return `"${file.name}" is not an allowed file. Use an image, a video (MP4, WebM, MOV) or a PDF.`;
  if (file.size === 0) return `"${file.name}" is empty.`;
  if (file.size > MAX_BYTES[kind]) return `"${file.name}" is too large: ${LABEL[kind]} files can be at most ${MAX_BYTES[kind] / MB} MB.`;
  return null;
}

/** Splits a selection into files that can go, and one message per file that cannot (or that would not fit). */
export function sortFiles(incoming: File[], already: number, limit: number = MAX_FILES_PER_TASK) {
  const accepted: File[] = [];
  const problems: string[] = [];
  for (const file of incoming) {
    const problem = problemWith(file);
    if (problem) problems.push(problem);
    else if (already + accepted.length >= limit) problems.push(`"${file.name}" was not added: a task can have at most ${limit} attachments.`);
    else accepted.push(file);
  }
  return { accepted, problems };
}
