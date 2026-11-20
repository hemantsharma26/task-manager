import { Router } from 'express';
import { ROUTE } from '../../constants/index.js';
import { writeRateLimit } from '../../shared/middleware/rate-limit.js';
import { ACTION } from '../../constants/index.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireAction, resolveWorkspace } from '../../shared/middleware/workspace.js';
import * as controller from './columns.controller.js';

export const columnRouter = Router();

columnRouter.use(requireAuth, resolveWorkspace, writeRateLimit);

columnRouter.get(ROUTE.COLUMNS.ROOT, requireAction(ACTION.VIEW), controller.list);
columnRouter.post(ROUTE.COLUMNS.ROOT, requireAction(ACTION.MANAGE_BOARD), controller.create);
columnRouter.patch(ROUTE.COLUMNS.BY_ID, requireAction(ACTION.MANAGE_BOARD), controller.update);
columnRouter.post(ROUTE.COLUMNS.MOVE, requireAction(ACTION.MANAGE_BOARD), controller.move);
columnRouter.delete(ROUTE.COLUMNS.BY_ID, requireAction(ACTION.MANAGE_BOARD), controller.remove);
