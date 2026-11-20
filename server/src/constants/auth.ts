export const AUTH_COOKIE = 'tm_token';

export const COOKIE = {
  SAME_SITE: 'lax',
  PATH: '/',
} as const;

export const SESSION = { DAYS: 7, ONE_DAY_MS: 24 * 60 * 60 * 1000 } as const;

export const BCRYPT_ROUNDS = { DEFAULT: 12, TEST: 4 } as const;

// Compared against when the email is unknown, so a failed login costs the same time either way.
export const DUMMY_PASSWORD = 'not-a-real-password';

export const PASSWORD_LIMITS = { MIN: 8, MAX: 72 /* bcrypt only reads the first 72 bytes */ } as const;
export const NAME_LIMITS = { MAX: 80 } as const;

export const AUTH_RATE_LIMIT = { WINDOW_MS: 15 * 60 * 1000, MAX: 20 } as const;
export const API_RATE_LIMIT = { WINDOW_MS: 60_000, MAX: 600 } as const;
