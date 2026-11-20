import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../api/http';
import { COLUMNS_KEY } from '../api/columns';
import { PRIORITIES_KEY } from '../api/priorities';
import { CreateDialog } from './CreateDialog';

// The status picker reads the user's columns, so give the component a client that already has them.
function render(ui: ReactElement) {
  const qc = new QueryClient();
  qc.setQueryData(COLUMNS_KEY, [
    { id: 'c1', key: 'todo', name: 'To do', isDone: false, color: null },
    { id: 'c2', key: 'review', name: 'Review', isDone: false, color: null },
    { id: 'c3', key: 'done', name: 'Done', isDone: true, color: null },
  ]);
  qc.setQueryData(PRIORITIES_KEY, [
    { id: 'p1', key: 'low', name: 'Low', color: '#1d7afc' },
    { id: 'p2', key: 'medium', name: 'Medium', color: '#e56910' },
    { id: 'p3', key: 'urgent', name: 'Urgent', color: '#c9372c' },
  ]);
  return rtlRender(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('CreateDialog', () => {
  it('offers the user\'s own columns as statuses, starting on the first one', async () => {
    render(<CreateDialog open onClose={() => {}} onSubmit={vi.fn()} />);
    const status = screen.getByLabelText(/status/i) as HTMLSelectElement;
    expect([...status.options].map((o) => o.text)).toEqual(['To do', 'Review', 'Done']);
    expect(status.value).toBe('todo');
  });

  it('offers the user\'s own priorities, starting on Medium', () => {
    render(<CreateDialog open onClose={() => {}} onSubmit={vi.fn()} />);
    const priority = screen.getByLabelText(/priority/i) as HTMLSelectElement;
    expect([...priority.options].map((o) => o.text)).toEqual(['Low', 'Medium', 'Urgent']);
    expect(priority.value).toBe('medium');
  });

  it('blocks an empty title without calling the API', async () => {
    const onSubmit = vi.fn();
    render(<CreateDialog open onClose={() => {}} onSubmit={onSubmit} />);
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));
    expect(await screen.findByText(/give the task a title/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('submits trimmed values with defaults', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(<CreateDialog open onClose={onClose} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByPlaceholderText(/what needs to be done/i), '  Call the bank  ');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Call the bank', description: '', status: 'todo', priority: 'medium', dueDate: null, dueTime: null, startTime: null, color: null }, []);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows a field error returned by the server and stays open', async () => {
    const onSubmit = vi.fn().mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', 'Some fields are invalid', [{ field: 'dueDate', message: 'Not a valid calendar date' }]));
    const onClose = vi.fn();
    render(<CreateDialog open onClose={onClose} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByPlaceholderText(/what needs to be done/i), 'Something');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));
    expect(await screen.findByText('Not a valid calendar date')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
