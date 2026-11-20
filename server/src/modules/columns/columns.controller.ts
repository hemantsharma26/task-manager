import type { Request, Response } from 'express';
import { HEADER, HTTP_STATUS, ROUTE_PARAM } from '../../constants/index.js';
import { toColumnDTO } from './columns.mapper.js';
import { createColumnSchema, deleteColumnQuerySchema, moveColumnSchema, updateColumnSchema } from './columns.schemas.js';
import * as columns from './columns.service.js';

const idOf = (req: Request) => String(req.params[ROUTE_PARAM.ID]);

/** Every write answers with the fresh list, so the client never has to guess the new order or keys. */
async function sendList(userId: string, res: Response, status: number = HTTP_STATUS.OK) {
  const { value, status: cacheStatus } = await columns.getColumns(userId);
  res.status(status).set(HEADER.X_CACHE, cacheStatus).json({ columns: value.map(toColumnDTO) });
}

export const list = (req: Request, res: Response) => sendList(req.userId!, res);

export async function create(req: Request, res: Response) {
  await columns.createColumn(req.userId!, createColumnSchema.parse(req.body));
  await sendList(req.userId!, res, HTTP_STATUS.CREATED);
}

export async function update(req: Request, res: Response) {
  await columns.updateColumn(req.userId!, idOf(req), updateColumnSchema.parse(req.body));
  await sendList(req.userId!, res);
}

export async function move(req: Request, res: Response) {
  await columns.moveColumn(req.userId!, idOf(req), moveColumnSchema.parse(req.body));
  await sendList(req.userId!, res);
}

export async function remove(req: Request, res: Response) {
  const { moveTo } = deleteColumnQuerySchema.parse(req.query);
  await columns.deleteColumn(req.userId!, idOf(req), moveTo);
  await sendList(req.userId!, res);
}
