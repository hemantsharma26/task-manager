import { createHash } from 'node:crypto';
import { CACHE_KEY_SEPARATOR, CACHE_NAMESPACE, CACHE_PREFIX, CACHE_SCHEMA_VERSION, HASH } from '../../constants/index.js';

// Every key the app writes is built here, and nowhere else:
//
//   tm:v1:user:<id>:version                      a counter that is bumped on every write
//   tm:v1:user:<id>:<version>:tasks:list:<hash>  one cached page of tasks (hash of the query)
//   tm:v1:user:<id>:<version>:tasks:stats:<hash>
//   tm:v1:user:<id>:<version>:columns
//
// Because the version is part of every data key, "forget everything cached for this user" is one INCR: old
// entries become unreachable and expire on their own. No scanning, and no deleting keys one by one.

const join = (...parts: (string | number)[]) => [CACHE_PREFIX, CACHE_SCHEMA_VERSION, ...parts].join(CACHE_KEY_SEPARATOR);

/** Same object, same hash, whatever the order the keys were written in. */
function hashOf(value: unknown): string {
  const canonical = JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v,
  );
  return createHash(HASH.ALGORITHM).update(canonical).digest(HASH.ENCODING).slice(0, HASH.LENGTH);
}

const userScope = (userId: string, version: number) => join(CACHE_NAMESPACE.USER, userId, `v${version}`);

export const cacheKeys = {
  version: (userId: string) => join(CACHE_NAMESPACE.USER, userId, CACHE_NAMESPACE.VERSION),
  taskList: (userId: string, version: number, query: unknown) => `${userScope(userId, version)}${CACHE_KEY_SEPARATOR}${CACHE_NAMESPACE.TASK_LIST}${CACHE_KEY_SEPARATOR}${hashOf(query)}`,
  taskStats: (userId: string, version: number, query: unknown) => `${userScope(userId, version)}${CACHE_KEY_SEPARATOR}${CACHE_NAMESPACE.TASK_STATS}${CACHE_KEY_SEPARATOR}${hashOf(query)}`,
  columns: (userId: string, version: number) => `${userScope(userId, version)}${CACHE_KEY_SEPARATOR}${CACHE_NAMESPACE.COLUMNS}`,
};
