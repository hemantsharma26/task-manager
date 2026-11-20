import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { createTaskSchema, listQuerySchema, moveTaskSchema, statsQuerySchema, updateTaskSchema } from '../schemas/task.js';
import * as tasks from '../services/task.service.js';

export const taskRouter = Router();

taskRouter.use(requireAuth);

// Declared before "/:id" so "stats" is not treated as an id.
taskRouter.get('/stats', async (req, res) => {
  const { today } = statsQuerySchema.parse(req.query);
  res.json(await tasks.getStats(req.userId!, today));
});

taskRouter.get('/', async (req, res) => {
  const query = listQuerySchema.parse(req.query);
  res.json(await tasks.listTasks(req.userId!, query));
});

taskRouter.post('/', async (req, res) => {
  const input = createTaskSchema.parse(req.body);
  res.status(201).json({ task: await tasks.createTask(req.userId!, input) });
});

taskRouter.get('/:id', async (req, res) => {
  res.json({ task: await tasks.getTask(req.userId!, String(req.params.id)) });
});

taskRouter.patch('/:id', async (req, res) => {
  const input = updateTaskSchema.parse(req.body);
  res.json({ task: await tasks.updateTask(req.userId!, String(req.params.id), input) });
});

taskRouter.post('/:id/move', async (req, res) => {
  const input = moveTaskSchema.parse(req.body);
  res.json({ task: await tasks.moveTask(req.userId!, String(req.params.id), input) });
});

taskRouter.delete('/:id', async (req, res) => {
  await tasks.deleteTask(req.userId!, String(req.params.id));
  res.status(204).end();
});
