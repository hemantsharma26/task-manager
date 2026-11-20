import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.js';
import { HttpError } from '../utils/httpError.js';
import type { LoginInput, RegisterInput } from '../schemas/auth.js';

const BCRYPT_ROUNDS = env.NODE_ENV === 'test' ? 4 : 12;

// Used when the email is unknown, so a failed login costs the same time either way
// and the response does not reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

export async function register(input: RegisterInput) {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  try {
    return await User.create({ name: input.name, email: input.email, passwordHash });
  } catch (err) {
    // The unique index is the source of truth; no racy "find then create".
    if ((err as { code?: number }).code === 11000) {
      throw HttpError.conflict('An account with this email already exists');
    }
    throw err;
  }
}

export async function login(input: LoginInput) {
  const user = await User.findOne({ email: input.email }).select('+passwordHash');
  const ok = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !ok) throw HttpError.unauthorized('Invalid email or password');
  return user;
}

export const signToken = (userId: string) =>
  jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

export function verifyToken(token: string): string {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload === 'string' || !payload.sub) throw new Error('Malformed token');
  return payload.sub;
}
