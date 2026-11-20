import pino from 'pino';
import { env } from '../config/env.js';
import { DEFAULT_LOG_LEVEL, DEFAULTS, LOG_REDACT, NODE_ENV } from '../constants/index.js';

// LOG_LEVEL in .env wins; otherwise a sensible default for the environment.
const level = env.LOG_LEVEL ?? DEFAULT_LOG_LEVEL[env.NODE_ENV];

export const logger = pino({
  level,
  redact: [...LOG_REDACT],
  ...(env.NODE_ENV === NODE_ENV.DEVELOPMENT && {
    transport: { target: DEFAULTS.LOGGER_PRETTY_TARGET, options: { colorize: true, translateTime: DEFAULTS.LOG_TIME_FORMAT } },
  }),
});
