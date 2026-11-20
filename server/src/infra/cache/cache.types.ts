/** The few operations the app needs from a cache. Redis implements it, and so does an in-process fallback. */
export interface CacheStore {
  readonly kind: string;
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds: number): Promise<void>;
  /** Atomically adds one to a counter (creating it at 1), and returns the new value. */
  increment(key: string): Promise<number>;
  delete(...keys: string[]): Promise<void>;
  close(): Promise<void>;
}
