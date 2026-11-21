const MB = 1024 * 1024;

// What may be attached to a task. The type is decided by looking INSIDE the file, never by its name or by what the browser
// says it is, and only these types are accepted. (SVG is deliberately not here: an SVG can carry script.)
export const ATTACHMENT_KIND = { IMAGE: 'image', VIDEO: 'video', PDF: 'pdf' } as const;
export type AttachmentKind = (typeof ATTACHMENT_KIND)[keyof typeof ATTACHMENT_KIND];

export const ALLOWED_FILE_TYPES: Readonly<Record<string, AttachmentKind>> = {
  'image/png': ATTACHMENT_KIND.IMAGE,
  'image/jpeg': ATTACHMENT_KIND.IMAGE,
  'image/gif': ATTACHMENT_KIND.IMAGE,
  'image/webp': ATTACHMENT_KIND.IMAGE,
  'video/mp4': ATTACHMENT_KIND.VIDEO,
  'video/webm': ATTACHMENT_KIND.VIDEO,
  'video/quicktime': ATTACHMENT_KIND.VIDEO,
  'application/pdf': ATTACHMENT_KIND.PDF,
};

export const UPLOAD = {
  FIELD: 'files',
  MAX_FILES_PER_REQUEST: 5,
  MAX_FILES_PER_TASK: 20,
  MAX_BYTES: { [ATTACHMENT_KIND.IMAGE]: 10 * MB, [ATTACHMENT_KIND.PDF]: 25 * MB, [ATTACHMENT_KIND.VIDEO]: 100 * MB },
  /** multer's own ceiling: the largest of the above. Each file is then checked against the limit for its real kind. */
  HARD_MAX_BYTES: 100 * MB,
  NAME_MAX_LENGTH: 120,
  /** Pretty names for the error messages. */
  KIND_LABEL: { [ATTACHMENT_KIND.IMAGE]: 'image', [ATTACHMENT_KIND.VIDEO]: 'video', [ATTACHMENT_KIND.PDF]: 'PDF' },
  CACHE_SECONDS: 3600,
  /** Upload URL as seen inside the /api mount, used to let multipart bodies through the JSON-only rule. */
  PATH_PATTERN: /^\/tasks\/[0-9a-fA-F]{24}\/attachments\/?$/,
} as const;

// Headers on a served file. A file is never HTML to the browser: it is shown as the type it really is, and for images and
// video the response also forbids loading anything else.
export const FILE_CSP = "default-src 'none'; sandbox";
