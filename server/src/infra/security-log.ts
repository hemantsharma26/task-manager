import { logger } from './logger.js';

/**
 * Security-relevant events (failed logins, lockouts, token reuse, blocked requests), each with a stable name.
 * Never put a password, token or full email in here: use the user id, or a short digest of the email.
 */
const securityLogger = logger.child({ channel: 'security' });

export const securityLog = (event: string, details: Record<string, unknown> = {}) => securityLogger.warn({ event, ...details }, event);
export const securityInfo = (event: string, details: Record<string, unknown> = {}) => securityLogger.info({ event, ...details }, event);
