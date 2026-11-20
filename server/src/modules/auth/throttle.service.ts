import { env } from '../../config/env.js';
import { ERROR_MESSAGE, SECURITY_EVENT, TIME } from '../../constants/index.js';
import { cache } from '../../infra/cache/index.js';
import { cacheKeys, digest } from '../../infra/cache/cache.keys.js';
import { securityLog } from '../../infra/security-log.js';
import { HttpError } from '../../shared/errors/http-error.js';

const MINUTE_S = TIME.MINUTE_MS / TIME.SECOND_MS;

// Brute-force protection that follows the ACCOUNT, not just the network address. The generic per-IP limiter still runs
// as well, but an attacker with many addresses gets nowhere with it, so these counters are keyed by what is attacked.
//
//  pair   (email + IP)  LOGIN_MAX_ATTEMPTS failures lock that pair for LOGIN_LOCKOUT_MINUTES. Keying on the pair means a
//         stranger cannot lock YOU out of your own account by typing wrong passwords from their address.
//  email  (any IP)      a much higher cap, for guessing spread across many addresses.
//
// Counters live in the cache store, so with Redis the limits are shared by every instance. An unreachable store fails
// open (the per-IP limiter is still in front): locking everybody out because Redis is down is the worse failure.

const count = async (key: string) => {
  try {
    return Number((await cache.getRaw(key)) ?? 0);
  } catch {
    return 0;
  }
};

async function lockedFor(key: string, max: number) {
  if ((await count(key)) < max) return 0;
  return Math.max(1, await cache.secondsLeft(key).catch(() => 0));
}

/** Throws 429 (with Retry-After) while this account+address, or this account overall, is locked. Call before checking the password. */
export async function assertLoginAllowed(email: string, ip: string) {
  const retry = Math.max(await lockedFor(cacheKeys.loginFailuresPair(email, ip), env.LOGIN_MAX_ATTEMPTS), await lockedFor(cacheKeys.loginFailuresEmail(email), env.LOGIN_EMAIL_MAX_ATTEMPTS));
  if (retry > 0) {
    securityLog(SECURITY_EVENT.LOGIN_LOCKED, { email: digest(email), ip, retryAfterSeconds: retry });
    throw HttpError.tooManyRequests(ERROR_MESSAGE.LOCKED_OUT, retry);
  }
}

export async function recordLoginFailure(email: string, ip: string) {
  await Promise.all([
    cache.incrementWithin(cacheKeys.loginFailuresPair(email, ip), env.LOGIN_LOCKOUT_MINUTES * MINUTE_S),
    cache.incrementWithin(cacheKeys.loginFailuresEmail(email), env.LOGIN_EMAIL_WINDOW_MINUTES * MINUTE_S),
  ]).catch(() => undefined);
}

/** A correct password clears the pair's counter. The per-email counter is left to expire by itself. */
export async function clearLoginFailures(email: string, ip: string) {
  await cache.deleteKeys(cacheKeys.loginFailuresPair(email, ip)).catch(() => undefined);
}

/** Counts one registration from this address, and throws 429 past REGISTER_MAX_PER_IP per window. */
export async function throttleRegistration(ip: string) {
  const key = cacheKeys.registrationsByIp(ip);
  const windowSeconds = env.REGISTER_WINDOW_MINUTES * MINUTE_S;
  const attempts = await cache.incrementWithin(key, windowSeconds).catch(() => 0);
  if (attempts > env.REGISTER_MAX_PER_IP) {
    securityLog(SECURITY_EVENT.REGISTER_THROTTLED, { ip });
    throw HttpError.tooManyRequests(ERROR_MESSAGE.REGISTER_THROTTLED, Math.max(1, await cache.secondsLeft(key).catch(() => windowSeconds)));
  }
}
