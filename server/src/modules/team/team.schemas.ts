import { z } from 'zod';
import { MEMBER_ROLES, VALIDATION_MESSAGE } from '../../constants/index.js';

const role = z.enum(MEMBER_ROLES, { error: VALIDATION_MESSAGE.ROLE });
const email = z.string().max(254).transform((v) => v.normalize('NFKC').trim().toLowerCase()).pipe(z.email(VALIDATION_MESSAGE.EMAIL));

export const inviteSchema = z.object({ email, role });
export const changeRoleSchema = z.object({ role });

export type InviteInput = z.infer<typeof inviteSchema>;
