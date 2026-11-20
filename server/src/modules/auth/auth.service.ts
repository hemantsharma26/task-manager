import bcrypt from 'bcryptjs';
import { isTest } from '../../config/env.js';
import { BCRYPT_ROUNDS, DUMMY_PASSWORD, ERROR_MESSAGE, MONGO } from '../../constants/index.js';
import { HttpError } from '../../shared/errors/http-error.js';
import type { LoginInput, RegisterInput } from './auth.schemas.js';
import { userRepository } from './auth.repository.js';

const rounds = isTest ? BCRYPT_ROUNDS.TEST : BCRYPT_ROUNDS.DEFAULT;

// Used when the email is unknown, so a failed login costs the same time either way
// and the response does not reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync(DUMMY_PASSWORD, rounds);

export async function register(input: RegisterInput) {
  const passwordHash = await bcrypt.hash(input.password, rounds);
  try {
    return await userRepository.create({ name: input.name, email: input.email, passwordHash });
  } catch (err) {
    // The unique index is the source of truth; no racy "find then create".
    if ((err as { code?: number }).code === MONGO.DUPLICATE_KEY_CODE) throw HttpError.conflict(ERROR_MESSAGE.EMAIL_TAKEN);
    throw err;
  }
}

export async function login(input: LoginInput) {
  const user = await userRepository.findByEmailWithPassword(input.email);
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw HttpError.unauthorized(ERROR_MESSAGE.INVALID_CREDENTIALS);
  return user;
}

export async function currentUser(userId: string) {
  const user = await userRepository.findById(userId);
  if (!user) throw HttpError.unauthorized(ERROR_MESSAGE.ACCOUNT_GONE);
  return user;
}
