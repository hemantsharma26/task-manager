import { cache } from '../../infra/cache/index.js';
import { cacheKeys } from '../../infra/cache/cache.keys.js';
import { AUTH_CACHE } from '../../constants/index.js';
import type { AccessClaims } from './token.service.js';
import { accessTokenLifetimeSeconds } from './token.service.js';

// Access tokens are checked without touching the database, so signing out has to be told to them another way:
// a short list of "revoked" markers in the cache. Each marker only has to outlive the longest-lived access token.
// If the cache is unreachable, the check passes (the token still dies on its own within ACCESS_TOKEN_MINUTES);
// refusing every request because Redis is down would be a worse outage than a 15-minute window.
const markerTtl = () => accessTokenLifetimeSeconds() + 60;

/** Signing out of one session: its access token stops working immediately. */
export async function denySession(sessionId: string) {
  await cache.setRaw(cacheKeys.deniedSession(sessionId), AUTH_CACHE.FLAG, markerTtl()).catch(() => undefined);
}

/** Every access token issued before now stops working (sign out everywhere, password change). */
export async function denyAllIssuedBefore(userId: string, whenMs = Date.now()) {
  await cache.setRaw(cacheKeys.tokensValidAfter(userId), String(whenMs), markerTtl()).catch(() => undefined);
}

export async function isRevoked(claims: AccessClaims): Promise<boolean> {
  try {
    const [denied, validAfter] = await Promise.all([cache.getRaw(cacheKeys.deniedSession(claims.sessionId)), cache.getRaw(cacheKeys.tokensValidAfter(claims.userId))]);
    return denied !== null || (validAfter !== null && claims.issuedAtMs < Number(validAfter));
  } catch {
    return false;
  }
}
