import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import {
  API_RATE_LIMIT,
  AUTH_DEFAULTS,
  AUTH_RATE_LIMIT,
  WRITE_RATE_LIMIT,
  BOOLEAN_ENV,
  CACHE_TTL_SECONDS,
  DEFAULTS,
  LOG_LEVEL,
  LOG_MESSAGE,
  NODE_ENV,
  SERVER,
  VALIDATION_MESSAGE,
} from '../constants/index.js';

// ---------------------------------------------------------------------------------------------
// Configuration comes from environment variables, and nowhere else. Values are read from, in order of
// priority (the first one that sets a variable wins, and real environment variables beat every file):
//   1. the real environment (what a server, Docker or CI sets)
//   2. server/.env.<NODE_ENV>     e.g. .env.test, committed, holds only harmless test settings
//   3. server/.env                your local settings (never committed)
// ---------------------------------------------------------------------------------------------
const SERVER_DIR = path.resolve(import.meta.dirname, '../..');
const mode = process.env.NODE_ENV ?? NODE_ENV.DEVELOPMENT;
loadDotenv({ path: [path.join(SERVER_DIR, `.env.${mode}`), path.join(SERVER_DIR, '.env')], quiet: true });

const bool = z.enum([BOOLEAN_ENV.TRUE, BOOLEAN_ENV.FALSE]);
const positiveInt = (fallback: number) => z.coerce.number().int().positive().default(fallback);

const schema = z.object({
  // --- app
  NODE_ENV: z.enum([NODE_ENV.DEVELOPMENT, NODE_ENV.TEST, NODE_ENV.PRODUCTION]).default(NODE_ENV.DEVELOPMENT),
  PORT: positiveInt(SERVER.DEFAULT_PORT),
  LOG_LEVEL: z.enum([LOG_LEVEL.SILENT, LOG_LEVEL.ERROR, LOG_LEVEL.WARN, LOG_LEVEL.INFO, LOG_LEVEL.DEBUG]).optional(),
  // Number of reverse proxies in front of the app (nginx, a load balancer). Needed for the real client IP.
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).default(SERVER.TRUST_PROXY_HOPS),

  // --- database
  MONGODB_URI: z.string().min(1, VALIDATION_MESSAGE.ENV_REQUIRED_MONGODB_URI),

  // --- auth
  JWT_SECRET: z.string().min(DEFAULTS.JWT_SECRET_MIN_LENGTH, VALIDATION_MESSAGE.ENV_JWT_SECRET_LENGTH(DEFAULTS.JWT_SECRET_MIN_LENGTH)),
  // A second secret, used only to "pepper" passwords before hashing. Different from JWT_SECRET on purpose.
  PASSWORD_PEPPER: z.string().min(DEFAULTS.PEPPER_MIN_LENGTH, VALIDATION_MESSAGE.ENV_PEPPER_LENGTH(DEFAULTS.PEPPER_MIN_LENGTH)),
  ACCESS_TOKEN_MINUTES: positiveInt(AUTH_DEFAULTS.ACCESS_TOKEN_MINUTES),
  // A session ends after this many days without use, or SESSION_MAX_DAYS after sign-in, whichever comes first.
  REFRESH_TOKEN_DAYS: positiveInt(AUTH_DEFAULTS.REFRESH_TOKEN_DAYS),
  SESSION_MAX_DAYS: positiveInt(AUTH_DEFAULTS.SESSION_MAX_DAYS),
  LOGIN_MAX_ATTEMPTS: positiveInt(AUTH_DEFAULTS.LOGIN_MAX_ATTEMPTS),
  LOGIN_LOCKOUT_MINUTES: positiveInt(AUTH_DEFAULTS.LOGIN_LOCKOUT_MINUTES),
  LOGIN_EMAIL_MAX_ATTEMPTS: positiveInt(AUTH_DEFAULTS.LOGIN_EMAIL_MAX_ATTEMPTS),
  LOGIN_EMAIL_WINDOW_MINUTES: positiveInt(AUTH_DEFAULTS.LOGIN_EMAIL_WINDOW_MINUTES),
  REGISTER_MAX_PER_IP: positiveInt(AUTH_DEFAULTS.REGISTER_MAX_PER_IP),
  REGISTER_WINDOW_MINUTES: positiveInt(AUTH_DEFAULTS.REGISTER_WINDOW_MINUTES),
  // Mark the session cookie Secure. Defaults to on in production; set false only if you serve over plain http
  // (a browser silently drops Secure cookies on http).
  COOKIE_SECURE: bool.optional(),
  CLIENT_ORIGIN: z.string().default(DEFAULTS.CLIENT_ORIGIN),
  // Extra origins allowed to send state-changing requests in production (comma separated). The app's own origin is always allowed.
  ALLOWED_ORIGINS: z.string().default(''),
  // Send Strict-Transport-Security. Turn on only when the app itself is served over HTTPS (normally nginx does this).
  HSTS_ENABLED: bool.default(BOOLEAN_ENV.FALSE),

  // --- cache
  REDIS_URL: z.string().optional(),
  CACHE_ENABLED: bool.default(BOOLEAN_ENV.TRUE),
  CACHE_TTL_TASK_LIST_SECONDS: positiveInt(CACHE_TTL_SECONDS.TASK_LIST),
  CACHE_TTL_TASK_STATS_SECONDS: positiveInt(CACHE_TTL_SECONDS.TASK_STATS),
  CACHE_TTL_COLUMNS_SECONDS: positiveInt(CACHE_TTL_SECONDS.COLUMNS),
  CACHE_TTL_PRIORITIES_SECONDS: positiveInt(CACHE_TTL_SECONDS.PRIORITIES),

  // --- uploads
  // Where attached files (images, videos, PDFs) are kept. Relative paths are relative to the server folder.
  UPLOAD_DIR: z.string().default('uploads'),

  // --- rate limiting
  // Off only in the automated tests, which sign in hundreds of times from one address.
  RATE_LIMITING_ENABLED: bool.default(BOOLEAN_ENV.TRUE),
  RATE_LIMIT_API_MAX: positiveInt(API_RATE_LIMIT.MAX),
  RATE_LIMIT_API_WINDOW_SECONDS: positiveInt(API_RATE_LIMIT.WINDOW_MS / 1000),
  RATE_LIMIT_WRITE_MAX: positiveInt(WRITE_RATE_LIMIT.MAX),
  RATE_LIMIT_WRITE_WINDOW_SECONDS: positiveInt(WRITE_RATE_LIMIT.WINDOW_MS / 1000),
  RATE_LIMIT_AUTH_MAX: positiveInt(AUTH_RATE_LIMIT.MAX),
  RATE_LIMIT_AUTH_WINDOW_SECONDS: positiveInt(AUTH_RATE_LIMIT.WINDOW_MS / 1000),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
  // Failing fast at boot, with the names of the bad variables, beats a confusing error on the first request.
  console.error(`${LOG_MESSAGE.ENV_INVALID}\n${problems}`);
  process.exit(1);
}

export const env = parsed.data;

// A secret copied straight from .env.example is public knowledge. Refuse to run in production with one.
if (env.NODE_ENV === NODE_ENV.PRODUCTION) {
  for (const name of ['JWT_SECRET', 'PASSWORD_PEPPER'] as const) {
    if (env[name].toLowerCase().startsWith(DEFAULTS.PLACEHOLDER_SECRET_PREFIX)) {
      console.error(LOG_MESSAGE.SECURITY_PLACEHOLDER_SECRET(name));
      process.exit(1);
    }
  }
}
/** Absolute path of the folder uploaded files live in. */
export const uploadDir = path.resolve(SERVER_DIR, env.UPLOAD_DIR);
export const allowedOrigins = env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean);
export const hstsEnabled = env.HSTS_ENABLED === BOOLEAN_ENV.TRUE;
export const isProd = env.NODE_ENV === NODE_ENV.PRODUCTION;
export const isTest = env.NODE_ENV === NODE_ENV.TEST;
export const cookieSecure = env.COOKIE_SECURE ? env.COOKIE_SECURE === BOOLEAN_ENV.TRUE : isProd;
export const rateLimitingEnabled = env.RATE_LIMITING_ENABLED === BOOLEAN_ENV.TRUE;
export const cacheEnabled = env.CACHE_ENABLED === BOOLEAN_ENV.TRUE;

/** The settings that are safe to print at boot: no secrets, and credentials in URLs are masked. */
export const publicConfig = () => ({
  nodeEnv: env.NODE_ENV,
  port: env.PORT,
  mongodb: maskCredentials(env.MONGODB_URI),
  redis: env.REDIS_URL ? maskCredentials(env.REDIS_URL) : null,
  cacheEnabled,
  cookieSecure,
});

function maskCredentials(url: string) {
  return url.replace(/\/\/[^@/]*@/, '//***@');
}
