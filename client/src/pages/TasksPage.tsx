import { useEffect, useState } from 'react';
import { useAuth } from '../api/auth';
import { ApiError } from '../api/http';
import { useCreateTask, useDeleteTask, useStats, useTasks, useUpdateTask } from '../api/tasks';
import type { Task, TaskInput } from '../api/types';
import { Filters } from '../components/Filters';
import { Header } from '../components/Header';
import { Pagination } from '../components/Pagination';
import { StatsBar } from '../components/StatsBar';
import { TaskFormDialog } from '../components/TaskFormDialog';
import { TaskItem } from '../components/TaskItem';
import { useToast } from '../components/Toast';
import { useTaskFilters } from '../hooks/useTaskFilters';
import { todayLocal } from '../lib/dates';

const messageOf = (err: unknown) => (err instanceof ApiError ? err.message : 'Something went wrong. Please try again.');

export function TasksPage() {
  const { user } = useAuth();
  const { notify } = useToast();
  const { filters, update, reset, isFiltered } = useTaskFilters();

  const tasks = useTasks(filters);
  const stats = useStats();
  const create = useCreateTask();
  const updateTask = useUpdateTask();
  const remove = useDeleteTask();

  // undefined = dialog closed, null = creating, Task = editing
  const [editing, setEditing] = useState<Task | null | undefined>(undefined);
  const today = todayLocal();

  const data = tasks.data;

  // If the last task on a page is deleted (or filters shrink the result), step back to a page that exists.
  useEffect(() => {
    if (data && filters.page > data.totalPages) update({ page: data.totalPages });
  }, [data, filters.page, update]);

  if (!user) return null;

  const toggle = (t: Task) =>
    updateTask.mutate(
      { id: t.id, changes: { status: t.status === 'done' ? 'todo' : 'done' } },
      { onError: (e) => notify('error', messageOf(e)) },
    );

  const save = async (input: TaskInput) => {
    if (editing) {
      // Throws on failure so the dialog can show server-side field errors.
      await updateTask.mutateAsync({ id: editing.id, changes: input });
      notify('success', 'Task updated');
    } else {
      await create.mutateAsync(input);
      notify('success', 'Task added');
    }
  };

  const hasAny = (stats.data?.total ?? 0) > 0;

  return (
    <>
      <Header user={user} />
      <main className="container">
        <div className="page-head">
          <div>
            <h1>Your tasks</h1>
            <p className="muted">Hi {user.name.split(' ')[0]}, here is what is on your plate.</p>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => setEditing(null)}>
            + New task
          </button>
        </div>

        <StatsBar
          filters={filters}
          onStatus={(status) => update({ status, due: undefined })}
          onOverdue={() => update({ due: filters.due === 'overdue' ? undefined : 'overdue', status: undefined })}
        />

        <Filters filters={filters} onChange={update} onReset={reset} isFiltered={isFiltered} />

        {tasks.isError && !data ? (
          <div className="empty" role="alert">
            <p>{messageOf(tasks.error)}</p>
            <button type="button" className="btn" onClick={() => void tasks.refetch()}>
              Try again
            </button>
          </div>
        ) : tasks.isPending ? (
          <ul className="task-list" aria-busy="true" aria-label="Loading tasks">
            {[0, 1, 2].map((i) => (
              <li key={i} className="task task-skeleton" />
            ))}
          </ul>
        ) : data && data.items.length === 0 ? (
          <div className="empty">
            {isFiltered || (hasAny && data.total === 0) ? (
              <>
                <p>No tasks match these filters.</p>
                <button type="button" className="btn" onClick={reset}>
                  Clear filters
                </button>
              </>
            ) : (
              <>
                <p className="empty-title">Nothing here yet</p>
                <p className="muted">Add your first task and it will show up here.</p>
                <button type="button" className="btn btn-primary" onClick={() => setEditing(null)}>
                  + New task
                </button>
              </>
            )}
          </div>
        ) : (
          data && (
            <>
              <ul className={`task-list ${tasks.isPlaceholderData ? 'is-stale' : ''}`}>
                {data.items.map((t) => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    today={today}
                    onToggle={toggle}
                    onEdit={setEditing}
                    onDelete={(task) =>
                      remove.mutate(task.id, {
                        onSuccess: () => notify('success', 'Task deleted'),
                        onError: (e) => notify('error', messageOf(e)),
                      })
                    }
                  />
                ))}
              </ul>
              <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={(page) => update({ page })} />
            </>
          )
        )}
      </main>

      <TaskFormDialog task={editing} onClose={() => setEditing(undefined)} onSubmit={save} />
    </>
  );
}
