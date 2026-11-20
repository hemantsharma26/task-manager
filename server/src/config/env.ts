import path from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import {
  API_RATE_LIMIT,
  AUTH_RATE_LIMIT,
  BOOLEAN_ENV,
  CACHE_TTL_SECONDS,
  DEFAULTS,
  LOG_LEVEL,
  LOG_MESSAGE,
  NODE_ENV,
  SERVER,
  SESSION,
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
  JWT_EXPIRES_IN: z.string().default(DEFAULTS.JWT_EXPIRES_IN),
  SESSION_COOKIE_DAYS: positiveInt(SESSION.DAYS),
  // Mark the session cookie Secure. Defaults to on in production; set false only if you serve over plain http
  // (a browser silently drops Secure cookies on http).
  COOKIE_SECURE: bool.optional(),
  CLIENT_ORIGIN: z.string().default(DEFAULTS.CLIENT_ORIGIN),

  // --- cache
  REDIS_URL: z.string().optional(),
  CACHE_ENABLED: bool.default(BOOLEAN_ENV.TRUE),
  CACHE_TTL_TASK_LIST_SECONDS: positiveInt(CACHE_TTL_SECONDS.TASK_LIST),
  CACHE_TTL_TASK_STATS_SECONDS: positiveInt(CACHE_TTL_SECONDS.TASK_STATS),
  CACHE_TTL_COLUMNS_SECONDS: positiveInt(CACHE_TTL_SECONDS.COLUMNS),

  // --- rate limiting
  RATE_LIMIT_API_MAX: positiveInt(API_RATE_LIMIT.MAX),
  RATE_LIMIT_API_WINDOW_SECONDS: positiveInt(API_RATE_LIMIT.WINDOW_MS / 1000),
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
export const isProd = env.NODE_ENV === NODE_ENV.PRODUCTION;
export const isTest = env.NODE_ENV === NODE_ENV.TEST;
export const cookieSecure = env.COOKIE_SECURE ? env.COOKIE_SECURE === BOOLEAN_ENV.TRUE : isProd;
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
