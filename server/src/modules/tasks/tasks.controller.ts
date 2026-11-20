import type { Request, Response } from 'express';
import { HEADER, HTTP_STATUS, ROUTE_PARAM } from '../../constants/index.js';
import { createTaskSchema, listQuerySchema, moveTaskSchema, statsQuerySchema, updateTaskSchema } from './tasks.schemas.js';
import * as tasks from './tasks.service.js';

const idOf = (req: Request) => String(req.params[ROUTE_PARAM.ID]);

export async function list(req: Request, res: Response) {
  const { value, status } = await tasks.listTasks(req.userId!, listQuerySchema.parse(req.query));
  res.set(HEADER.X_CACHE, status).json(value);
}

export async function stats(req: Request, res: Response) {
  const { today, nowTime } = statsQuerySchema.parse(req.query);
  const { value, status } = await tasks.getStats(req.userId!, today, nowTime);
  res.set(HEADER.X_CACHE, status).json(value);
}

export async function get(req: Request, res: Response) {
  res.json({ task: await tasks.getTask(req.userId!, idOf(req)) });
}

export async function create(req: Request, res: Response) {
  res.status(HTTP_STATUS.CREATED).json({ task: await tasks.createTask(req.userId!, createTaskSchema.parse(req.body)) });
}

export async function update(req: Request, res: Response) {
  res.json({ task: await tasks.updateTask(req.userId!, idOf(req), updateTaskSchema.parse(req.body)) });
}

export async function move(req: Request, res: Response) {
  res.json({ task: await tasks.moveTask(req.userId!, idOf(req), moveTaskSchema.parse(req.body)) });
}

export async function remove(req: Request, res: Response) {
  await tasks.deleteTask(req.userId!, idOf(req));
  res.status(HTTP_STATUS.NO_CONTENT).end();
}
