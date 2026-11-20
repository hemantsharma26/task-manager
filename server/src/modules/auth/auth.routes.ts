import { Router } from 'express';
import { ROUTE } from '../../constants/index.js';
import { authRateLimit } from '../../shared/middleware/rate-limit.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import * as controller from './auth.controller.js';

export const authRouter = Router();

authRouter.post(ROUTE.AUTH.REGISTER, authRateLimit, controller.register);
authRouter.post(ROUTE.AUTH.LOGIN, authRateLimit, controller.login);
authRouter.post(ROUTE.AUTH.LOGOUT, controller.logout);
authRouter.get(ROUTE.AUTH.ME, requireAuth, controller.me);
