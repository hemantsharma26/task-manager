export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const HTTP_METHOD = { GET: 'GET' } as const;

export const HEADER = {
  CACHE_CONTROL: 'Cache-Control',
  X_CACHE: 'X-Cache',
  VARY_COOKIE: 'Cookie',
} as const;

export const CACHE_CONTROL = {
  /** Private to the user, and the browser must revalidate (a cheap 304 when nothing changed). */
  PRIVATE_REVALIDATE: 'private, no-cache',
  REVALIDATE: 'no-cache',
  /** Fingerprinted build files never change under the same name. */
  IMMUTABLE_ONE_YEAR: 'public, max-age=31536000, immutable',
} as const;

/** What the X-Cache response header says about where a response came from. */
export const CACHE_STATUS = { HIT: 'HIT', MISS: 'MISS' } as const;
export type CacheStatus = (typeof CACHE_STATUS)[keyof typeof CACHE_STATUS];

export const RATE_LIMIT_HEADERS_DRAFT = 'draft-7';
