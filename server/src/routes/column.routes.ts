import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createColumnSchema, deleteColumnQuerySchema, moveColumnSchema, updateColumnSchema } from '../schemas/column.js';
import * as columns from '../services/column.service.js';

export const columnRouter = Router();

columnRouter.use(requireAuth);

columnRouter.get('/', async (req, res) => {
  res.json({ columns: await columns.listColumns(req.userId!) });
});

columnRouter.post('/', async (req, res) => {
  const input = createColumnSchema.parse(req.body);
  await columns.createColumn(req.userId!, input);
  res.status(201).json({ columns: await columns.listColumns(req.userId!) });
});

columnRouter.patch('/:id', async (req, res) => {
  const input = updateColumnSchema.parse(req.body);
  await columns.updateColumn(req.userId!, String(req.params.id), input);
  res.json({ columns: await columns.listColumns(req.userId!) });
});

columnRouter.post('/:id/move', async (req, res) => {
  const input = moveColumnSchema.parse(req.body);
  res.json({ columns: await columns.moveColumn(req.userId!, String(req.params.id), input) });
});

columnRouter.delete('/:id', async (req, res) => {
  const { moveTo } = deleteColumnQuerySchema.parse(req.query);
  await columns.deleteColumn(req.userId!, String(req.params.id), moveTo);
  res.json({ columns: await columns.listColumns(req.userId!) });
});
