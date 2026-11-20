import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { http } from './http';
import { TASKS_KEY } from './cache';
import type { Invitation, InvitationInfo, Member, MemberRole, Role, Workspace } from './types';

export const WORKSPACES_KEY = ['workspaces'] as const;
export const MEMBERS_KEY = ['team', 'members'] as const;
export const INVITATIONS_KEY = ['team', 'invitations'] as const;

/** The boards the signed-in person can open. */
export function useWorkspaces() {
  return useQuery({
    queryKey: WORKSPACES_KEY,
    queryFn: ({ signal }) => http<{ own: Workspace; shared: Workspace[] }>('/workspaces', { signal }),
    staleTime: 60_000,
  });
}

/** The people on the current board: who can be given a task. */
export function useMembers() {
  return useQuery({
    queryKey: MEMBERS_KEY,
    queryFn: ({ signal }) => http<{ members: Member[]; you: { userId: string; role: Role; canManage: boolean } }>('/team/members', { signal }),
    staleTime: 60_000,
  });
}

export function useInvitations(enabled: boolean) {
  return useQuery({
    queryKey: INVITATIONS_KEY,
    enabled,
    queryFn: ({ signal }) => http<{ invitations: Invitation[] }>('/team/invitations', { signal }).then((r) => r.invitations),
  });
}

export function useInvite() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { email: string; role: MemberRole }) => http<{ invitation: Invitation }>('/team/invitations', { method: 'POST', body: v }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVITATIONS_KEY }),
  });
}

export function useRevokeInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => http<void>(`/team/invitations/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: INVITATIONS_KEY }),
  });
}

export function useChangeRole() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { userId: string; role: MemberRole }) => http<{ members: Member[] }>(`/team/members/${v.userId}`, { method: 'PATCH', body: { role: v.role } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: MEMBERS_KEY }),
  });
}

/** Removing a member also takes them off every task, so the tasks are reloaded too. */
export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => http<void>(`/team/members/${userId}`, { method: 'DELETE' }),
    onSuccess: () => Promise.all([qc.invalidateQueries({ queryKey: MEMBERS_KEY }), qc.invalidateQueries({ queryKey: TASKS_KEY }), qc.invalidateQueries({ queryKey: WORKSPACES_KEY })]),
  });
}

export const useInvitationInfo = (token: string) =>
  useQuery({
    queryKey: ['invitation', token],
    queryFn: ({ signal }) => http<{ invitation: InvitationInfo }>(`/invitations/${encodeURIComponent(token)}`, { signal }).then((r) => r.invitation),
    retry: false,
    staleTime: Infinity,
  });

export function useAcceptInvitation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (token: string) => http<{ workspaceId: string }>(`/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST', body: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: WORKSPACES_KEY }),
  });
}
