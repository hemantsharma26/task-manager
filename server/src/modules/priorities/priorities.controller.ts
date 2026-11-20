import type { Request, Response } from 'express';
import { HEADER, HTTP_STATUS, ROUTE_PARAM } from '../../constants/index.js';
import { toPriorityDTO } from './priorities.mapper.js';
import { createPrioritySchema, deletePriorityQuerySchema, movePrioritySchema, updatePrioritySchema } from './priorities.schemas.js';
import * as priorities from './priorities.service.js';

const idOf = (req: Request) => String(req.params[ROUTE_PARAM.ID]);

/** Every write answers with the fresh list, so the client never has to guess the new order or keys. */
async function sendList(userId: string, res: Response, status: number = HTTP_STATUS.OK) {
  const { value, status: cacheStatus } = await priorities.getPriorities(userId);
  res.status(status).set(HEADER.X_CACHE, cacheStatus).json({ priorities: value.map(toPriorityDTO) });
}

export const list = (req: Request, res: Response) => sendList(req.userId!, res);

export async function create(req: Request, res: Response) {
  await priorities.createPriority(req.userId!, createPrioritySchema.parse(req.body));
  await sendList(req.userId!, res, HTTP_STATUS.CREATED);
}

export async function update(req: Request, res: Response) {
  await priorities.updatePriority(req.userId!, idOf(req), updatePrioritySchema.parse(req.body));
  await sendList(req.userId!, res);
}

export async function move(req: Request, res: Response) {
  await priorities.movePriority(req.userId!, idOf(req), movePrioritySchema.parse(req.body));
  await sendList(req.userId!, res);
}

export async function remove(req: Request, res: Response) {
  const { moveTo } = deletePriorityQuerySchema.parse(req.query);
  await priorities.deletePriority(req.userId!, idOf(req), moveTo);
  await sendList(req.userId!, res);
}
