// Names of the two cookies. In production (HTTPS) the browser-enforced prefixes are added, see cookieName() in the auth module:
//   __Host-   cookie must be Secure, have Path=/ and no Domain, so a sibling subdomain cannot overwrite it
//   __Secure- cookie must be Secure
export const COOKIE_BASE = { ACCESS: 'tm_at', REFRESH: 'tm_rt' } as const;
export const COOKIE_PREFIX = { HOST: '__Host-', SECURE: '__Secure-' } as const;

export const COOKIE = {
  SAME_SITE_LAX: 'lax',
  SAME_SITE_STRICT: 'strict',
  PATH_ALL: '/',
  /** The refresh cookie is only ever sent to the auth routes, never with ordinary API calls. */
  PATH_REFRESH: '/api/auth',
} as const;

export const TIME = { SECOND_MS: 1000, MINUTE_MS: 60_000, HOUR_MS: 3_600_000, DAY_MS: 24 * 60 * 60 * 1000 } as const;

export const TOKEN = {
  ALGORITHM: 'HS256',
  ISSUER: 'task-manager',
  AUDIENCE: 'task-manager-web',
  /** Refresh tokens are 256 random bits, and only their SHA-256 is stored. */
  REFRESH_BYTES: 32,
  /** A just-rotated refresh token presented again within this window is a parallel request (two tabs), not theft. */
  REFRESH_GRACE_MS: 10_000,
  HASH_ALGORITHM: 'sha256',
  HASH_ENCODING: 'hex',
  SECRET_ENCODING: 'base64',
} as const;

export const SESSION_REVOKE_REASON = {
  LOGOUT: 'logout',
  LOGOUT_ALL: 'logout_all',
  PASSWORD_CHANGED: 'password_changed',
  REUSE_DETECTED: 'refresh_token_reuse',
  REVOKED_BY_USER: 'revoked_by_user',
} as const;

export const BCRYPT_ROUNDS = { DEFAULT: 12, TEST: 4 } as const;
export const NAME_LIMITS = { MAX: 80 } as const;
export const EMAIL_LIMITS = { MAX: 254 } as const;
export const USER_AGENT_MAX_LENGTH = 200;
export const MAX_SESSIONS_LISTED = 20;

export const PASSWORD = {
  MIN: 10,
  /** Passwords are pre-hashed (HMAC-SHA256), so bcrypt's 72-byte limit does not apply; this is only a sanity cap. */
  MAX: 128,
  /** A long passphrase is accepted without character-class rules. */
  PASSPHRASE_LENGTH: 16,
  MIN_CLASSES: 3,
  MIN_PART_LENGTH_FOR_PERSONAL_CHECK: 4,
  DUMMY: 'not-a-real-password',
} as const;

// Defaults for the settings that can be changed in .env
export const AUTH_DEFAULTS = {
  ACCESS_TOKEN_MINUTES: 15,
  REFRESH_TOKEN_DAYS: 7,
  SESSION_MAX_DAYS: 30,
  LOGIN_MAX_ATTEMPTS: 5,
  LOGIN_LOCKOUT_MINUTES: 15,
  LOGIN_EMAIL_MAX_ATTEMPTS: 25,
  LOGIN_EMAIL_WINDOW_MINUTES: 60,
  REGISTER_MAX_PER_IP: 10,
  REGISTER_WINDOW_MINUTES: 60,
} as const;

export const AUTH_RATE_LIMIT = { WINDOW_MS: 15 * 60 * 1000, MAX: 20 } as const;
export const API_RATE_LIMIT = { WINDOW_MS: 60_000, MAX: 600 } as const;
export const WRITE_RATE_LIMIT = { WINDOW_MS: 60_000, MAX: 240 } as const;

/** Security events written to the log, one stable name each so they can be searched and alerted on. */
export const SECURITY_EVENT = {
  REGISTERED: 'auth.registered',
  LOGIN_SUCCEEDED: 'auth.login_succeeded',
  LOGIN_FAILED: 'auth.login_failed',
  LOGIN_LOCKED: 'auth.login_locked',
  REGISTER_THROTTLED: 'auth.register_throttled',
  REFRESH_REUSE_DETECTED: 'auth.refresh_token_reuse_detected',
  LOGOUT_ALL: 'auth.logout_all',
  PASSWORD_CHANGED: 'auth.password_changed',
  SESSION_REVOKED: 'auth.session_revoked',
  ORIGIN_BLOCKED: 'security.origin_blocked',
  OPERATOR_KEYS_BLOCKED: 'security.operator_keys_blocked',
  NON_JSON_BLOCKED: 'security.non_json_blocked',
} as const;
