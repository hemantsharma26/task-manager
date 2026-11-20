import { createHash, randomBytes } from 'node:crypto';
import { appUrl } from '../../config/env.js';
import { ERROR_MESSAGE, ROLE, ROLE_LABEL, TEAM, TEAM_EVENT, TIME, TOKEN, type MemberRole } from '../../constants/index.js';
import { cache } from '../../infra/cache/index.js';
import { invitationMail, sendMail } from '../../infra/mail/index.js';
import { securityInfo } from '../../infra/security-log.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { userRepository } from '../auth/auth.repository.js';
import { taskRepository } from '../tasks/tasks.repository.js';
import type { InviteInput } from './team.schemas.js';
import { teamRepository } from './team.repository.js';

const sha256 = (v: string) => createHash(TOKEN.HASH_ALGORITHM).update(v).digest(TOKEN.HASH_ENCODING);
const boardName = (ownerName: string) => `${ownerName}${TEAM.BOARD_SUFFIX}`;

export interface Person {
  userId: string;
  name: string;
  email: string;
  role: string;
  isOwner: boolean;
}

/** The owner first, then everyone who joined. These are the people a task can be assigned to. */
export async function listMembers(workspaceId: string): Promise<Person[]> {
  const [owner, memberships] = await Promise.all([userRepository.findById(workspaceId), teamRepository.findMembers(workspaceId)]);
  if (!owner) throw HttpError.notFound(ERROR_MESSAGE.WORKSPACE_NOT_FOUND);
  const users = await userRepository.findManyByIds(memberships.map((m) => String(m.user)));
  const byId = new Map(users.map((u) => [String(u._id), u]));
  return [
    { userId: String(owner._id), name: owner.name, email: owner.email, role: ROLE.OWNER, isOwner: true },
    ...memberships.flatMap((m) => {
      const u = byId.get(String(m.user));
      return u ? [{ userId: String(m.user), name: u.name, email: u.email, role: m.role, isOwner: false }] : [];
    }),
  ];
}

/** Names and emails for some user ids (the people on a task). */
export async function peopleByIds(ids: string[]): Promise<Map<string, { id: string; name: string; email: string }>> {
  const users = await userRepository.findManyByIds(ids);
  return new Map(users.map((u) => [String(u._id), { id: String(u._id), name: u.name, email: u.email }]));
}

/** How the board is called in emails and on screen. */
export async function boardLabel(workspaceId: string): Promise<string> {
  const owner = await userRepository.findById(workspaceId);
  return boardName(owner?.name ?? 'Someone');
}

/** The ids tasks on this board may be assigned to. */
export async function assignableIds(workspaceId: string): Promise<Set<string>> {
  return new Set((await listMembers(workspaceId)).map((p) => p.userId));
}

export async function inviteMember(workspaceId: string, actor: { id: string; name: string; email: string }, input: InviteInput) {
  if (input.email === actor.email.toLowerCase()) throw HttpError.badRequest(ERROR_MESSAGE.INVITE_YOURSELF);

  const people = await listMembers(workspaceId);
  if (people.some((p) => p.email.toLowerCase() === input.email)) throw HttpError.conflict(ERROR_MESSAGE.ALREADY_MEMBER);
  if (people.length >= TEAM.MAX_MEMBERS) throw HttpError.badRequest(ERROR_MESSAGE.TEAM_FULL(TEAM.MAX_MEMBERS));
  if ((await teamRepository.countPending(workspaceId)) >= TEAM.MAX_PENDING_INVITES) throw HttpError.badRequest(ERROR_MESSAGE.TOO_MANY_INVITES(TEAM.MAX_PENDING_INVITES));

  const owner = people[0]!;
  const token = randomBytes(TEAM.TOKEN_BYTES).toString('base64url');
  await teamRepository.revokePendingFor(workspaceId, input.email);
  const invitation = await teamRepository.createInvitation({
    workspace: workspaceId,
    email: input.email,
    role: input.role,
    invitedBy: actor.id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + TEAM.INVITE_TTL_DAYS * TIME.DAY_MS),
  });

  // Sent in the background: the person inviting never waits for, or fails because of, the mail server.
  void sendMail(invitationMail({ to: input.email, inviterName: actor.name, groupName: boardName(owner.name), roleName: ROLE_LABEL[input.role], url: `${appUrl}/join/${token}`, expiresInDays: TEAM.INVITE_TTL_DAYS }));
  securityInfo(TEAM_EVENT.INVITED, { workspaceId, by: actor.id, role: input.role });
  return { id: String(invitation._id), email: invitation.email, role: invitation.role, expiresAt: invitation.expiresAt, token };
}

export async function listInvitations(workspaceId: string) {
  return (await teamRepository.findPending(workspaceId)).map((i) => ({ id: String(i._id), email: i.email, role: i.role, expiresAt: i.expiresAt, createdAt: i.createdAt }));
}

export async function revokeInvitation(workspaceId: string, invitationId: string) {
  const invitation = await teamRepository.findInvitationOwned(workspaceId, invitationId);
  if (!invitation || invitation.acceptedAt) throw HttpError.notFound(ERROR_MESSAGE.INVITATION_INVALID);
  invitation.revokedAt = new Date();
  await invitation.save();
  securityInfo(TEAM_EVENT.INVITE_REVOKED, { workspaceId, invitationId });
}

export async function changeRole(workspaceId: string, userId: string, role: MemberRole) {
  const membership = await teamRepository.findMembership(workspaceId, userId);
  if (!membership) throw HttpError.notFound(ERROR_MESSAGE.MEMBER_NOT_FOUND);
  membership.role = role;
  await membership.save();
  securityInfo(TEAM_EVENT.ROLE_CHANGED, { workspaceId, userId, role });
}

/** Removes someone from the board, and from every task they were assigned to. */
export async function removeMember(workspaceId: string, userId: string) {
  if (userId === workspaceId) throw HttpError.badRequest(ERROR_MESSAGE.LEAVE_AS_OWNER);
  const membership = await teamRepository.findMembership(workspaceId, userId);
  if (!membership) throw HttpError.notFound(ERROR_MESSAGE.MEMBER_NOT_FOUND);
  await teamRepository.removeMember(workspaceId, userId);
  await taskRepository.unassign(workspaceId, userId);
  await cache.invalidateUser(workspaceId);
  securityInfo(TEAM_EVENT.REMOVED, { workspaceId, userId });
}

// Joining ---------------------------------------------------------------------------------------------

/** What the join page shows before anyone signs in: who invited you, to what, as what. Reveals nothing else. */
export async function describeInvitation(token: string) {
  const invitation = await teamRepository.findInvitationByHash(sha256(token));
  if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) throw HttpError.notFound(ERROR_MESSAGE.INVITATION_INVALID);
  const [owner, inviter] = await Promise.all([userRepository.findById(String(invitation.workspace)), userRepository.findById(String(invitation.invitedBy))]);
  return { boardName: boardName(owner?.name ?? 'Someone'), invitedBy: inviter?.name ?? 'Someone', role: invitation.role, roleLabel: ROLE_LABEL[invitation.role], email: invitation.email };
}

/** Accepting works only for the signed-in account whose email the invitation was sent to. */
export async function acceptInvitation(token: string, user: { id: string; email: string }) {
  const invitation = await teamRepository.findInvitationByHash(sha256(token));
  if (!invitation || invitation.acceptedAt || invitation.revokedAt || invitation.expiresAt <= new Date()) throw HttpError.notFound(ERROR_MESSAGE.INVITATION_INVALID);
  if (invitation.email !== user.email.toLowerCase()) throw HttpError.forbidden(ERROR_MESSAGE.INVITATION_WRONG_ACCOUNT(invitation.email));

  const workspaceId = String(invitation.workspace);
  if (workspaceId !== user.id && !(await teamRepository.findMembership(workspaceId, user.id))) {
    if ((await teamRepository.countMembers(workspaceId)) >= TEAM.MAX_MEMBERS) throw HttpError.badRequest(ERROR_MESSAGE.TEAM_FULL(TEAM.MAX_MEMBERS));
    await teamRepository.addMember(workspaceId, user.id, invitation.role);
  }
  invitation.acceptedAt = new Date();
  await invitation.save();
  await cache.invalidateUser(workspaceId);
  securityInfo(TEAM_EVENT.JOINED, { workspaceId, userId: user.id, role: invitation.role });
  return { workspaceId };
}

/** The boards a person can open: their own, and the ones they joined. */
export async function myWorkspaces(user: { id: string; name: string }) {
  const memberships = await teamRepository.findMembershipsOfUser(user.id);
  const owners = await userRepository.findManyByIds(memberships.map((m) => String(m.workspace)));
  const byId = new Map(owners.map((o) => [String(o._id), o]));
  return {
    own: { id: user.id, name: boardName(user.name), role: ROLE.OWNER },
    shared: memberships.flatMap((m) => {
      const o = byId.get(String(m.workspace));
      return o ? [{ id: String(m.workspace), name: boardName(o.name), role: m.role }] : [];
    }),
  };
}
