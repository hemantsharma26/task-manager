import jwt from 'jsonwebtoken';
import { env } from '../../config/env.js';
import { ERROR_MESSAGE } from '../../constants/index.js';

export const signToken = (userId: string) =>
  jwt.sign({}, env.JWT_SECRET, {
    subject: userId,
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });

export function verifyToken(token: string): string {
  const payload = jwt.verify(token, env.JWT_SECRET);
  if (typeof payload === 'string' || !payload.sub) throw new Error(ERROR_MESSAGE.MALFORMED_TOKEN);
  return payload.sub;
}
