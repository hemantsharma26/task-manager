import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render as rtlRender, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '../api/http';
import { COLUMNS_KEY } from '../api/columns';
import { PRIORITIES_KEY } from '../api/priorities';
import { MEMBERS_KEY } from '../api/team';
import { CreateDialog } from './CreateDialog';

// What this person may do on the board decides whether the assignee field is shown.
const permissions = vi.hoisted(() => ({ canAssign: true }));
vi.mock('../api/workspace', () => ({ useWorkspace: () => ({ can: (a: string) => (a === 'task.assign' ? permissions.canAssign : true) }) }));

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
  qc.setQueryData(MEMBERS_KEY, {
    members: [
      { userId: 'u1', name: 'Asha Verma', email: 'asha@example.com', role: 'owner', isOwner: true },
      { userId: 'u2', name: 'Sam Rao', email: 'sam@example.com', role: 'editor', isOwner: false },
      { userId: 'u3', name: 'Priya Nair', email: 'priya@example.com', role: 'viewer', isOwner: false },
    ],
    you: { userId: 'u1', role: 'owner', canManage: true },
  });
  return rtlRender(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe('CreateDialog', () => {
  beforeEach(() => {
    permissions.canAssign = true;
  });

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
    expect(onSubmit).toHaveBeenCalledWith({ title: 'Call the bank', description: '', status: 'todo', priority: 'medium', dueDate: null, dueTime: null, startTime: null, color: null, assignees: [] }, []);
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

  it('lets several people be picked from the team and sends their ids', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CreateDialog open onClose={() => {}} onSubmit={onSubmit} />);
    await userEvent.type(screen.getByPlaceholderText(/what needs to be done/i), 'Review the contract');
    await userEvent.click(screen.getByRole('button', { name: /^assignees: nobody/i }));
    await userEvent.click(screen.getByRole('option', { name: /asha verma/i }));
    await userEvent.click(screen.getByRole('option', { name: /priya nair/i }));
    expect(screen.getByRole('option', { name: /asha verma/i })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('option', { name: /sam rao/i })).toHaveAttribute('aria-selected', 'false');
    await userEvent.keyboard('{Escape}');
    await userEvent.click(screen.getByRole('button', { name: /^create$/i }));
    expect(onSubmit.mock.calls[0]![0].assignees).toEqual(['u1', 'u3']);
  });

  it('does not offer assigning to someone who may not assign', () => {
    permissions.canAssign = false;
    render(<CreateDialog open onClose={() => {}} onSubmit={vi.fn()} />);
    expect(screen.queryByRole('button', { name: /assignees/i })).not.toBeInTheDocument();
  });
});
