import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../api/http';
import { COLUMNS_KEY } from '../api/columns';
import { CreateDialog } from './CreateDialog';

// The status picker reads the user's columns, so give the component a client that already has them.
function render(ui: ReactElement) {
  const qc = new QueryClient();
  qc.setQueryData(COLUMNS_KEY, [
    { id: 'c1', key: 'todo', name: 'To do', isDone: false },
    { id: 'c2', key: 'review', name: 'Review', isDone: false },
    { id: 'c3', key: 'done', name: 'Done', isDone: true },
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
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Call the bank', description: '', status: 'todo', priority: 'medium', dueDate: null });
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
