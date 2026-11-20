import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../api/http';
import { TaskFormDialog } from './TaskFormDialog';

describe('TaskFormDialog', () => {
  it('blocks an empty title without calling the API', async () => {
    const onSubmit = vi.fn();
    render(<TaskFormDialog task={null} onClose={() => {}} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: /add task/i }));
    expect(await screen.findByText(/give the task a title/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed values with defaults', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<TaskFormDialog task={null} onClose={onClose} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByPlaceholderText(/what needs to be done/i), '  Call the bank  ');
    await userEvent.click(screen.getByRole('button', { name: /add task/i }));
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Call the bank', description: '', status: 'todo', priority: 'medium', dueDate: null });
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a field error returned by the server and stays open', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'Some fields are invalid', [{ field: 'dueDate', message: 'Not a valid calendar date' }]));
    const onClose = vi.fn();
    render(<TaskFormDialog task={null} onClose={onClose} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByPlaceholderText(/what needs to be done/i), 'Something');
    await userEvent.click(screen.getByRole('button', { name: /add task/i }));
    expect(await screen.findByText('Not a valid calendar date')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
