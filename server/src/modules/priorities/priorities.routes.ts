import { Router } from 'express';
import { ROUTE } from '../../constants/index.js';
import { writeRateLimit } from '../../shared/middleware/rate-limit.js';
import { ACTION } from '../../constants/index.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireAction, resolveWorkspace } from '../../shared/middleware/workspace.js';
import * as controller from './priorities.controller.js';

export const priorityRouter = Router();

priorityRouter.use(requireAuth, resolveWorkspace, writeRateLimit);

priorityRouter.get(ROUTE.PRIORITIES.ROOT, requireAction(ACTION.VIEW), controller.list);
priorityRouter.post(ROUTE.PRIORITIES.ROOT, requireAction(ACTION.MANAGE_BOARD), controller.create);
priorityRouter.patch(ROUTE.PRIORITIES.BY_ID, requireAction(ACTION.MANAGE_BOARD), controller.update);
priorityRouter.post(ROUTE.PRIORITIES.MOVE, requireAction(ACTION.MANAGE_BOARD), controller.move);
priorityRouter.delete(ROUTE.PRIORITIES.BY_ID, requireAction(ACTION.MANAGE_BOARD), controller.remove);
