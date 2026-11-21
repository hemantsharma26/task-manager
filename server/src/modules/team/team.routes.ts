import { Router } from 'express';
import { ACTION, ROUTE } from '../../constants/index.js';
import { authRateLimit, writeRateLimit } from '../../shared/middleware/rate-limit.js';
import { requireAuth } from '../../shared/middleware/require-auth.js';
import { requireAction, resolveWorkspace } from '../../shared/middleware/workspace.js';
import * as controller from './team.controller.js';

/** The people on one board: who they are, inviting more, changing roles, removing. */
export const teamRouter = Router();
teamRouter.use(requireAuth, resolveWorkspace, writeRateLimit);
teamRouter.get(ROUTE.TEAM.MEMBERS, requireAction(ACTION.VIEW), controller.members);
teamRouter.patch(ROUTE.TEAM.MEMBER_BY_ID, requireAction(ACTION.MANAGE_TEAM), controller.changeRole);
// Leaving is allowed for everyone; removing somebody else is checked inside.
teamRouter.delete(ROUTE.TEAM.MEMBER_BY_ID, requireAction(ACTION.VIEW), controller.removeMember);
teamRouter.get(ROUTE.TEAM.INVITATIONS, requireAction(ACTION.MANAGE_TEAM), controller.invitations);
teamRouter.post(ROUTE.TEAM.INVITATIONS, requireAction(ACTION.MANAGE_TEAM), controller.invite);
teamRouter.delete(ROUTE.TEAM.INVITATION_BY_ID, requireAction(ACTION.MANAGE_TEAM), controller.revoke);

/** The link in the email. Looking at it needs no account; accepting needs the account the invitation was sent to. */
export const invitationRouter = Router();
invitationRouter.get(ROUTE.INVITATIONS.BY_TOKEN, authRateLimit, controller.describeInvitation);
invitationRouter.post(ROUTE.INVITATIONS.ACCEPT, authRateLimit, requireAuth, controller.acceptInvitation);

/** The boards the signed-in person can open. */
export const workspaceRouter = Router();
workspaceRouter.get('/', requireAuth, controller.workspaces);
