import type { Request, Response } from 'express';
import { ACTION, ERROR_MESSAGE, HEADER, HTTP_STATUS, ROUTE_PARAM } from '../../constants/index.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { can } from '../../shared/middleware/workspace.js';
import { userRepository } from '../auth/auth.repository.js';
import { createTaskSchema, listQuerySchema, moveTaskSchema, statsQuerySchema, updateTaskSchema } from './tasks.schemas.js';
import * as tasks from './tasks.service.js';

const idOf = (req: Request) => String(req.params[ROUTE_PARAM.ID]);

/** Who is acting, for "X assigned you ..." emails. */
async function actorOf(req: Request) {
  const user = await userRepository.findById(req.userId!);
  if (!user) throw HttpError.unauthorized(ERROR_MESSAGE.ACCOUNT_GONE);
  return { id: String(user._id), name: user.name };
}

/** Assigning people is its own right: someone may be allowed to edit a task without being allowed to hand it out. */
const requireAssignRight = (req: Request, assignees: unknown) => {
  if (assignees !== undefined && !can(req.workspaceRole, ACTION.ASSIGN)) throw HttpError.forbidden(ERROR_MESSAGE.NOT_ALLOWED('assign tasks here'));
};

export async function list(req: Request, res: Response) {
  const { value, status } = await tasks.listTasks(req.workspaceId!, listQuerySchema.parse(req.query), req.userId!);
  res.set(HEADER.X_CACHE, status).json(value);
}

export async function stats(req: Request, res: Response) {
  const { today, nowTime } = statsQuerySchema.parse(req.query);
  const { value, status } = await tasks.getStats(req.workspaceId!, today, nowTime);
  res.set(HEADER.X_CACHE, status).json(value);
}

export async function get(req: Request, res: Response) {
  res.json({ task: await tasks.getTask(req.workspaceId!, idOf(req)) });
}

export async function create(req: Request, res: Response) {
  const input = createTaskSchema.parse(req.body);
  if (input.assignees.length) requireAssignRight(req, input.assignees);
  res.status(HTTP_STATUS.CREATED).json({ task: await tasks.createTask(req.workspaceId!, input, await actorOf(req)) });
}

export async function update(req: Request, res: Response) {
  const input = updateTaskSchema.parse(req.body);
  requireAssignRight(req, input.assignees);
  res.json({ task: await tasks.updateTask(req.workspaceId!, idOf(req), input, await actorOf(req)) });
}

export async function move(req: Request, res: Response) {
  res.json({ task: await tasks.moveTask(req.workspaceId!, idOf(req), moveTaskSchema.parse(req.body)) });
}

export async function remove(req: Request, res: Response) {
  await tasks.deleteTask(req.workspaceId!, idOf(req));
  res.status(HTTP_STATUS.NO_CONTENT).end();
}
