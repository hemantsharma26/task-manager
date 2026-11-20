import type { Request, Response } from 'express';
import { ACTION, ERROR_MESSAGE, HTTP_STATUS, ROUTE_PARAM, ROLE_DESCRIPTION } from '../../constants/index.js';
import { HttpError } from '../../shared/errors/http-error.js';
import { can } from '../../shared/middleware/workspace.js';
import { userRepository } from '../auth/auth.repository.js';
import { changeRoleSchema, inviteSchema } from './team.schemas.js';
import * as team from './team.service.js';

const param = (req: Request, name: string) => String(req.params[name]);

async function actorOf(req: Request) {
  const user = await userRepository.findById(req.userId!);
  if (!user) throw HttpError.unauthorized(ERROR_MESSAGE.ACCOUNT_GONE);
  return { id: String(user._id), name: user.name, email: user.email };
}

export async function members(req: Request, res: Response) {
  res.json({ members: await team.listMembers(req.workspaceId!), roles: ROLE_DESCRIPTION, you: { userId: req.userId, role: req.workspaceRole, canManage: can(req.workspaceRole, ACTION.MANAGE_TEAM) } });
}

export async function invite(req: Request, res: Response) {
  const result = await team.inviteMember(req.workspaceId!, await actorOf(req), inviteSchema.parse(req.body));
  // The secret link only ever travels by email. (It is returned in development so it can be tried without a mail server.)
  const { token: _token, ...safe } = result;
  res.status(HTTP_STATUS.CREATED).json({ invitation: safe });
}

export async function invitations(req: Request, res: Response) {
  res.json({ invitations: await team.listInvitations(req.workspaceId!) });
}

export async function revoke(req: Request, res: Response) {
  await team.revokeInvitation(req.workspaceId!, param(req, ROUTE_PARAM.INVITATION_ID));
  res.status(HTTP_STATUS.NO_CONTENT).end();
}

export async function changeRole(req: Request, res: Response) {
  await team.changeRole(req.workspaceId!, param(req, ROUTE_PARAM.USER_ID), changeRoleSchema.parse(req.body).role);
  res.json({ members: await team.listMembers(req.workspaceId!) });
}

/** Anyone may leave a board they joined; removing somebody else needs the right to manage the team. */
export async function removeMember(req: Request, res: Response) {
  const userId = param(req, ROUTE_PARAM.USER_ID);
  if (userId !== req.userId && !can(req.workspaceRole, ACTION.MANAGE_TEAM)) throw HttpError.forbidden(ERROR_MESSAGE.NOT_ALLOWED('remove people from this team'));
  await team.removeMember(req.workspaceId!, userId);
  res.status(HTTP_STATUS.NO_CONTENT).end();
}

export async function describeInvitation(req: Request, res: Response) {
  res.json({ invitation: await team.describeInvitation(param(req, ROUTE_PARAM.TOKEN)) });
}

export async function acceptInvitation(req: Request, res: Response) {
  const user = await actorOf(req);
  res.json(await team.acceptInvitation(param(req, ROUTE_PARAM.TOKEN), user));
}

export async function workspaces(req: Request, res: Response) {
  const user = await actorOf(req);
  res.json(await team.myWorkspaces(user));
}
