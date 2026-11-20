import { Router } from 'express';
import { ACTION, ROUTE } from '../../constants/index.js';
import { writeRateLimit } from '../../shared/middleware/rate-limit.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireAction, resolveWorkspace } from '../../shared/middleware/workspace.js';
import * as attachmentsController from '../attachments/attachments.controller.js';
import * as controller from './tasks.controller.js';

export const taskRouter = Router();

taskRouter.use(requireAuth, resolveWorkspace, writeRateLimit);

// Declared before "/:id" so "stats" is not treated as an id.
taskRouter.get(ROUTE.TASKS.STATS, requireAction(ACTION.VIEW), controller.stats);
taskRouter.get(ROUTE.TASKS.ROOT, requireAction(ACTION.VIEW), controller.list);
taskRouter.post(ROUTE.TASKS.ROOT, requireAction(ACTION.CREATE_TASK), controller.create);
taskRouter.get(ROUTE.TASKS.BY_ID, requireAction(ACTION.VIEW), controller.get);
taskRouter.patch(ROUTE.TASKS.BY_ID, requireAction(ACTION.EDIT_TASK), controller.update);
taskRouter.post(ROUTE.TASKS.MOVE, requireAction(ACTION.EDIT_TASK), controller.move);
taskRouter.delete(ROUTE.TASKS.BY_ID, requireAction(ACTION.DELETE_TASK), controller.remove);

// Files attached to a task
taskRouter.post(ROUTE.TASKS.ATTACHMENTS, requireAction(ACTION.EDIT_TASK), attachmentsController.receiveFiles, attachmentsController.upload);
taskRouter.get(ROUTE.TASKS.ATTACHMENT_BY_ID, requireAction(ACTION.VIEW), attachmentsController.download);
taskRouter.delete(ROUTE.TASKS.ATTACHMENT_BY_ID, requireAction(ACTION.EDIT_TASK), attachmentsController.remove);
