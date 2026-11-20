import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Task } from '../api/types';
import { TaskItem } from './TaskItem';

const base: Task = {
  id: '1',
  title: 'Pay rent',
  description: 'Before the 5th',
  status: 'todo',
  priority: 'high',
  dueDate: '2026-11-18',
  completedAt: null,
  createdAt: '2026-11-01T00:00:00Z',
  updatedAt: '2026-11-01T00:00:00Z',
};

const setup = (task: Partial<Task> = {}) => {
  const handlers = { onToggle: vi.fn(), onEdit: vi.fn(), onDelete: vi.fn() };
  render(<TaskItem task={{ ...base, ...task }} today="2026-11-20" {...handlers} />);
  return handlers;
};

describe('TaskItem', () => {
  it('flags an unfinished task past its due date', () => {
    setup();
    expect(screen.getByText(/Overdue by 2 days/)).toBeInTheDocument();
  });

  it('does not flag a finished task', () => {
    setup({ status: 'done' });
    expect(screen.queryByText(/Overdue/)).not.toBeInTheDocument();
  });

  it('toggles through the checkbox', async () => {
    const { onToggle } = setup();
    await userEvent.click(screen.getByRole('checkbox', { name: /mark "pay rent" as done/i }));
    expect(onToggle).toHaveBeenCalledWith(expect.objectContaining({ id: '1' }));
  });

  it('asks for confirmation before deleting', async () => {
    const { onDelete } = setup();
    await userEvent.click(screen.getByRole('button', { name: /delete "pay rent"/i }));
    expect(onDelete).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole('button', { name: /yes, delete/i }));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('lets you back out of a delete', async () => {
    const { onDelete } = setup();
    await userEvent.click(screen.getByRole('button', { name: /delete "pay rent"/i }));
    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: /edit "pay rent"/i })).toBeInTheDocument();
  });
});
