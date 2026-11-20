import { Router } from 'express';
import { ROUTE } from '../../constants/index.js';
import { writeRateLimit } from '../../shared/middleware/rate-limit.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import * as controller from './columns.controller.js';

export const columnRouter = Router();

columnRouter.use(requireAuth, writeRateLimit);

columnRouter.get(ROUTE.COLUMNS.ROOT, controller.list);
columnRouter.post(ROUTE.COLUMNS.ROOT, controller.create);
columnRouter.patch(ROUTE.COLUMNS.BY_ID, controller.update);
columnRouter.post(ROUTE.COLUMNS.MOVE, controller.move);
columnRouter.delete(ROUTE.COLUMNS.BY_ID, controller.remove);
