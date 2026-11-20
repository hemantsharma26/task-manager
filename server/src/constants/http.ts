export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  PAYLOAD_TOO_LARGE: 413,
  UNSUPPORTED_MEDIA_TYPE: 415,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
} as const;

export const HTTP_METHOD = { GET: 'GET', HEAD: 'HEAD', OPTIONS: 'OPTIONS', POST: 'POST', PUT: 'PUT', PATCH: 'PATCH', DELETE: 'DELETE' } as const;
export const SAFE_METHODS: readonly string[] = [HTTP_METHOD.GET, HTTP_METHOD.HEAD, HTTP_METHOD.OPTIONS];
export const METHODS_WITH_BODY: readonly string[] = [HTTP_METHOD.POST, HTTP_METHOD.PUT, HTTP_METHOD.PATCH];

export const HEADER = {
  CACHE_CONTROL: 'Cache-Control',
  X_CACHE: 'X-Cache',
  VARY_COOKIE: 'Cookie',
  REQUEST_ID: 'X-Request-Id',
  RETRY_AFTER: 'Retry-After',
  ORIGIN: 'origin',
  SEC_FETCH_SITE: 'sec-fetch-site',
  CONTENT_TYPE: 'content-type',
  USER_AGENT: 'user-agent',
  PERMISSIONS_POLICY: 'Permissions-Policy',
} as const;

export const CACHE_CONTROL = {
  /** Private to the user, and the browser must revalidate (a cheap 304 when nothing changed). */
  PRIVATE_REVALIDATE: 'private, no-cache',
  REVALIDATE: 'no-cache',
  /** Fingerprinted build files never change under the same name. */
  IMMUTABLE_ONE_YEAR: 'public, max-age=31536000, immutable',
  /** Responses that carry credentials or account data must never be stored anywhere. */
  NO_STORE: 'no-store',
} as const;

/** What the X-Cache response header says about where a response came from. */
export const CACHE_STATUS = { HIT: 'HIT', MISS: 'MISS' } as const;
export type CacheStatus = (typeof CACHE_STATUS)[keyof typeof CACHE_STATUS];

export const RATE_LIMIT_HEADERS_DRAFT = 'draft-7';

export const CONTENT_TYPE_JSON = 'application/json';
export const SEC_FETCH_SITE = { CROSS_SITE: 'cross-site', SAME_ORIGIN: 'same-origin', SAME_SITE: 'same-site', NONE: 'none' } as const;

// Sent on every response. CSP is the main defence against XSS: nothing from outside our own origin may run or load.
export const PERMISSIONS_POLICY = 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()';
export const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'"],
  styleSrc: ["'self'"],
  // React sets some style="" attributes (drag positions, colours); scripts stay locked down.
  styleSrcAttr: ["'unsafe-inline'"],
  imgSrc: ["'self'", 'data:'],
  fontSrc: ["'self'"],
  connectSrc: ["'self'"],
  objectSrc: ["'none'"],
  baseUri: ["'self'"],
  formAction: ["'self'"],
  frameAncestors: ["'none'"],
  frameSrc: ["'none'"],
  manifestSrc: ["'self'"],
} as const;
export const HSTS = { MAX_AGE_SECONDS: 15_552_000, INCLUDE_SUBDOMAINS: true } as const;
