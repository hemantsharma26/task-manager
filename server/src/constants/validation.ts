export const VALIDATION_MESSAGE = {
  EMAIL: 'Enter a valid email address',
  NAME_REQUIRED: 'Name is required',
  PASSWORD_MIN: 'Password must be at least 8 characters',
  PASSWORD_REQUIRED: 'Password is required',
  TITLE_REQUIRED: 'Title is required',
  TITLE_TOO_LONG: (max: number) => `Title is too long (max ${max})`,
  DESCRIPTION_TOO_LONG: (max: number) => `Description is too long (max ${max})`,
  DATE_FORMAT: 'Use the format YYYY-MM-DD',
  DATE_INVALID: 'Not a valid calendar date',
  NOTHING_TO_UPDATE: 'Send at least one field to update',
  INVALID_ID: 'Invalid id',
  COLUMN_NAME_REQUIRED: 'Give the column a name',
  COLUMN_NAME_TOO_LONG: (max: number) => `Keep the name under ${max} characters`,
  ENV_REQUIRED_MONGODB_URI: 'MONGODB_URI is required',
  ENV_JWT_SECRET_LENGTH: (min: number) => `JWT_SECRET must be at least ${min} characters`,
} as const;

export const PATTERN = {
  ISO_DATE: /^\d{4}-\d{2}-\d{2}$/,
  OBJECT_ID: /^[0-9a-fA-F]{24}$/,
  REGEX_SPECIALS: /[.*+?^${}()|[\]\\]/g,
  NON_ALPHANUMERIC_RUN: /[^a-z0-9]+/g,
  EDGE_UNDERSCORES: /^_+|_+$/g,
  NEWLINE: /\n/g,
} as const;
