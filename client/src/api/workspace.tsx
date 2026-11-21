import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from './auth';
import { COLUMNS_KEY } from './columns';
import { TASKS_KEY } from './cache';
import { setActiveWorkspace } from './http';
import { PRIORITIES_KEY } from './priorities';
import { MEMBERS_KEY, INVITATIONS_KEY, useWorkspaces } from './team';
import { can as roleCan, type Action } from '../lib/permissions';
import type { Role, Workspace } from './types';

interface WorkspaceState {
  /** The board on screen. */
  current: Workspace;
  all: Workspace[];
  /** True when the board belongs to someone else. */
  isShared: boolean;
  role: Role;
  can: (action: Action) => boolean;
  switchTo: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceState | null>(null);

const storageKey = (userId: string) => `tm.board.${userId}`;
const readChoice = (userId: string) => {
  try {
    return localStorage.getItem(storageKey(userId));
  } catch {
    return null;
  }
};
const writeChoice = (userId: string, id: string) => {
  try {
    localStorage.setItem(storageKey(userId), id);
  } catch {
    /* private mode: the choice just is not remembered */
  }
};

/** Makes a board the one that opens next (used right after accepting an invitation). */
export const rememberBoard = (userId: string, id: string) => writeChoice(userId, id);

/**
 * Knows which board is open and what the signed-in person may do there. Everything else (tasks, columns, priorities, the
 * team) is loaded for that board, so switching boards drops what was cached for the old one.
 */
export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const workspaces = useWorkspaces();
  // A link in an assignment email names the board (?board=), which then takes priority over the remembered one.
  const [chosen, setChosen] = useState<string | null>(() => (user ? (new URLSearchParams(window.location.search).get('board') ?? readChoice(user.id)) : null));

  const all = useMemo<Workspace[]>(() => (workspaces.data ? [workspaces.data.own, ...workspaces.data.shared] : []), [workspaces.data]);
  // A remembered board the person was removed from (or that no longer exists) falls back to their own.
  const current = all.find((w) => w.id === chosen) ?? workspaces.data?.own;

  // Requests carry the board id as soon as it is known, before any child renders and asks for data.
  if (current) setActiveWorkspace(current.id === user?.id ? null : current.id);

  const drop = useCallback(() => {
    for (const key of [TASKS_KEY, ['stats'], COLUMNS_KEY, PRIORITIES_KEY, MEMBERS_KEY, INVITATIONS_KEY]) qc.removeQueries({ queryKey: key });
  }, [qc]);

  const switchTo = useCallback(
    (id: string) => {
      if (!user || id === current?.id) return;
      setActiveWorkspace(id === user.id ? null : id);
      drop();
      writeChoice(user.id, id);
      setChosen(id);
    },
    [user, current?.id, drop],
  );

  // If the person is removed from the board they are looking at, step back to their own without a stale error screen.
  useEffect(() => {
    if (!user || !chosen || !workspaces.data) return;
    if (all.some((w) => w.id === chosen)) writeChoice(user.id, chosen);
    else {
      drop();
      setChosen(user.id);
    }
  }, [user, chosen, workspaces.data, all, drop]);

  const value = useMemo<WorkspaceState | null>(
    () =>
      current
        ? { current, all, isShared: current.id !== user?.id, role: current.role, can: (a) => roleCan(current.role, a), switchTo }
        : null,
    [current, all, user?.id, switchTo],
  );

  if (workspaces.isError) {
    return (
      <div className="splash-error" role="alert">
        <p>Could not load your boards.</p>
        <button type="button" className="btn" onClick={() => void workspaces.refetch()}>
          Try again
        </button>
      </div>
    );
  }
  if (!value) return <div className="splash" role="status" aria-label="Loading" />;
  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceState {
  const ctx = useContext(WorkspaceContext);
  if (!ctx) throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return ctx;
}
