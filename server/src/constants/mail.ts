export const MAIL = {
  /** Sending is retried this many times, with a growing pause, before giving up (the request that caused it never waits). */
  MAX_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1500,
  DEFAULT_FROM: 'Task Manager <no-reply@localhost>',
  SUBJECT_MAX: 150,
} as const;

export const MAIL_TRANSPORT = { SMTP: 'smtp', LOG_ONLY: 'log-only' } as const;

export const MAIL_TEMPLATE = {
  INVITATION: 'invitation',
  ASSIGNMENT: 'assignment',
} as const;

export const MAIL_LOG = {
  SENT: 'Email sent',
  FAILED: 'Email could not be sent',
  GAVE_UP: 'Email abandoned after repeated failures',
  LOG_ONLY: 'No SMTP configured: the email below was NOT sent (set SMTP_URL to send it)',
  TRANSPORT: (kind: string) => `Mail transport: ${kind}`,
} as const;
