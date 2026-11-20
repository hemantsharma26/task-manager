import { Router } from 'express';
import { ROUTE } from '../../constants/index.js';
import { authRateLimit } from '../../shared/middleware/rate-limit.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import * as controller from './auth.controller.js';

export const authRouter = Router();

authRouter.use(controller.noStore);

// Sign in, register and refresh are the doors an attacker knocks on, so they get the strict limiter.
authRouter.post(ROUTE.AUTH.REGISTER, authRateLimit, controller.register);
authRouter.post(ROUTE.AUTH.LOGIN, authRateLimit, controller.login);
authRouter.post(ROUTE.AUTH.REFRESH, authRateLimit, controller.refresh);
authRouter.post(ROUTE.AUTH.LOGOUT, controller.logout);

authRouter.post(ROUTE.AUTH.LOGOUT_ALL, requireAuth, controller.logoutAll);
authRouter.get(ROUTE.AUTH.ME, requireAuth, controller.me);
authRouter.post(ROUTE.AUTH.PASSWORD, requireAuth, authRateLimit, controller.changePassword);
authRouter.get(ROUTE.AUTH.SESSIONS, requireAuth, controller.listSessions);
authRouter.delete(ROUTE.AUTH.SESSION_BY_ID, requireAuth, controller.revokeSession);

