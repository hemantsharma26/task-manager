import { createHmac } from 'node:crypto';
import bcrypt from 'bcryptjs';
import { env, isTest } from '../../config/env.js';
import { BCRYPT_ROUNDS, PASSWORD, TOKEN } from '../../constants/index.js';

const rounds = isTest ? BCRYPT_ROUNDS.TEST : BCRYPT_ROUNDS.DEFAULT;

/**
 * The password is first run through HMAC-SHA256 with a secret "pepper" that lives in the environment, not in the
 * database, and only then through bcrypt. Two effects: a stolen database alone cannot be cracked offline (the
 * attacker would also need the pepper), and bcrypt always sees a fixed 44-character string, so its 72-byte limit
 * and its habit of stopping at a NUL byte can no longer silently weaken a long or unusual password.
 */
const prehash = (password: string) => createHmac(TOKEN.HASH_ALGORITHM, env.PASSWORD_PEPPER).update(password).digest(TOKEN.SECRET_ENCODING);

export const hashPassword = (password: string) => bcrypt.hash(prehash(password), rounds);

// Compared against when the email is unknown, so a failed login costs the same time either way.
const DUMMY_HASH = bcrypt.hashSync(prehash(PASSWORD.DUMMY), rounds);

export interface PasswordCheck {
  ok: boolean;
  /** The stored hash uses a weaker cost than today's setting: rewrite it now that we have the plain password. */
  needsRehash: boolean;
}

export async function verifyPassword(password: string, hash: string | undefined): Promise<PasswordCheck> {
  const ok = await bcrypt.compare(prehash(password), hash ?? DUMMY_HASH);
  return { ok: ok && hash !== undefined, needsRehash: ok && hash !== undefined && bcrypt.getRounds(hash) < rounds };
}
