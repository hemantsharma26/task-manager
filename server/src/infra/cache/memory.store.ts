import { CACHE_STORE } from '../../constants/index.js';
import type { CacheStore } from './cache.types.js';

interface Entry {
  value: string;
  /** Epoch ms, or undefined for entries that never expire (counters). */
  expiresAt?: number;
}

/** In-process store: used when there is no Redis, and in tests. Same behaviour, but private to one instance. */
export class MemoryStore implements CacheStore {
  readonly kind = CACHE_STORE.MEMORY;
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  // Read and write happen in one synchronous step (no await in between), so concurrent callers can never interleave.
  private peek(key: string) {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (entry.expiresAt !== undefined && entry.expiresAt <= this.now()) {
      this.entries.delete(key);
      return null;
    }
    return entry.value;
  }

  async get(key: string) {
    return this.peek(key);
  }

  async set(key: string, value: string, ttlSeconds: number) {
    this.entries.set(key, { value, expiresAt: this.now() + ttlSeconds * 1000 });
  }

  async increment(key: string) {
    const next = Number(this.peek(key) ?? 0) + 1;
    this.entries.set(key, { value: String(next) });
    return next;
  }

  async delete(...keys: string[]) {
    for (const key of keys) this.entries.delete(key);
  }

  async close() {
    this.entries.clear();
  }

  /** Number of live entries, for tests. */
  get size() {
    return this.entries.size;
  }
}
