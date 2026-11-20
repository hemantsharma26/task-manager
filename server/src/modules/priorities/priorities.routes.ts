import { Router } from 'express';
import { ROUTE } from '../../constants/index.js';
import { writeRateLimit } from '../../shared/middleware/rate-limit.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import * as controller from './priorities.controller.js';

export const priorityRouter = Router();

priorityRouter.use(requireAuth, writeRateLimit);

priorityRouter.get(ROUTE.PRIORITIES.ROOT, controller.list);
priorityRouter.post(ROUTE.PRIORITIES.ROOT, controller.create);
priorityRouter.patch(ROUTE.PRIORITIES.BY_ID, controller.update);
priorityRouter.post(ROUTE.PRIORITIES.MOVE, controller.move);
priorityRouter.delete(ROUTE.PRIORITIES.BY_ID, controller.remove);
