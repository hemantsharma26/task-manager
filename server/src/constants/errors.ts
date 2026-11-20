export const ERROR_CODE = {
  ERROR: 'ERROR',
  BAD_REQUEST: 'BAD_REQUEST',
  UNAUTHORIZED: 'UNAUTHORIZED',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  INTERNAL: 'INTERNAL',
} as const;

export const ERROR_MESSAGE = {
  AUTH_REQUIRED: 'Authentication required',
  SESSION_EXPIRED: 'Session expired, please sign in again',
  ACCOUNT_GONE: 'Account no longer exists',
  INVALID_CREDENTIALS: 'Invalid email or password',
  EMAIL_TAKEN: 'An account with this email already exists',
  MALFORMED_TOKEN: 'Malformed token',

  VALIDATION_FAILED: 'Some fields are invalid',
  MALFORMED_REQUEST: 'Malformed request',
  BODY_TOO_LARGE: 'Request body is too large',
  INTERNAL: 'Something went wrong on our side',
  RESOURCE_NOT_FOUND: 'Resource not found',
  ROUTE_NOT_FOUND: (method: string, url: string) => `Route not found: ${method} ${url}`,

  TASK_NOT_FOUND: 'Task not found',
  TASK_PLACEMENT_FAILED: 'Could not place the task, please try again',
  UNKNOWN_COLUMN: (key: string) => `There is no column "${key}" on your board`,

  COLUMN_NOT_FOUND: 'Column not found',
  COLUMN_PLACEMENT_FAILED: 'Could not place the column, please try again',
  COLUMN_LIMIT: (max: number) => `You can have at most ${max} columns`,
  COLUMN_NAME_TAKEN: (name: string) => `There is already a column called "${name}"`,
  COLUMN_LAST: 'A board needs at least one column',
  COLUMN_HAS_TASKS: (count: number) => `This column has ${count} ${count === 1 ? 'task' : 'tasks'}. Choose a column to move them to.`,
  COLUMN_BAD_TARGET: 'Pick a different, existing column to move the tasks to',

  TOO_MANY_AUTH_ATTEMPTS: 'Too many attempts, try again in a few minutes',
  TOO_MANY_REQUESTS: 'Too many requests, slow down a little',
} as const;
