import { Router } from 'express';
import { ROUTE } from '../../constants/index.js';
import { writeRateLimit } from '../../shared/middleware/rate-limit.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import * as attachmentsController from '../attachments/attachments.controller.js';
import * as controller from './tasks.controller.js';

export const taskRouter = Router();

taskRouter.use(requireAuth, writeRateLimit);

// Declared before "/:id" so "stats" is not treated as an id.
taskRouter.get(ROUTE.TASKS.STATS, controller.stats);
taskRouter.get(ROUTE.TASKS.ROOT, controller.list);
taskRouter.post(ROUTE.TASKS.ROOT, controller.create);
taskRouter.get(ROUTE.TASKS.BY_ID, controller.get);
taskRouter.patch(ROUTE.TASKS.BY_ID, controller.update);
taskRouter.post(ROUTE.TASKS.MOVE, controller.move);
taskRouter.delete(ROUTE.TASKS.BY_ID, controller.remove);

// Files attached to a task
taskRouter.post(ROUTE.TASKS.ATTACHMENTS, attachmentsController.receiveFiles, attachmentsController.upload);
taskRouter.get(ROUTE.TASKS.ATTACHMENT_BY_ID, attachmentsController.download);
taskRouter.delete(ROUTE.TASKS.ATTACHMENT_BY_ID, attachmentsController.remove);
