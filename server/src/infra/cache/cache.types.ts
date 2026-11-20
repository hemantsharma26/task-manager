/** The few operations the app needs from a cache. Redis implements it, and so does an in-process fallback. */
export interface CacheStore {
  readonly kind: string;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /**
   * Atomically adds one to a counter (creating it at 1), and returns the new value.
   * With `ttlSeconds`, the counter expires that long after it was created (not after each increment), which
   * is what a "N attempts per window" limit needs.
   */
  increment(key: string, ttlSeconds?: number): Promise<number>;
  /** Seconds until the key expires: 0 if it is gone or has no expiry. */
  ttl(key: string): Promise<number>;
  delete(...keys: string[]): Promise<void>;
  close(): Promise<void>;
}
