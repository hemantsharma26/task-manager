import type { RequestHandler } from 'express';
import { ACTION, ERROR_MESSAGE, PATTERN, ROLE, ROLE_ACTIONS, TEAM_HEADER, type Action, type Role } from '../../constants/index.js';
import { Membership } from '../../modules/team/membership.model.js';
import { HttpError } from '../errors/http-error.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** The board this request works on: the signed-in user's own, or one they were invited to. */
    workspaceId?: string;
    workspaceRole?: Role;
  }
}

/**
 * Decides which board a request is about, and what the caller may do there. With no X-Workspace-Id header it is the caller's
 * own board (they are its owner). With one, the caller must really be a member of that board, otherwise the board does not
 * exist as far as they can tell (a 404, the same as for an id that is not real).
 */
export const resolveWorkspace: RequestHandler = async (req, _res, next) => {
  try {
    const requested = req.get(TEAM_HEADER.WORKSPACE_ID);
    if (!requested || requested === req.userId) {
      req.workspaceId = req.userId;
      req.workspaceRole = ROLE.OWNER;
      return next();
    }
    if (!PATTERN.OBJECT_ID.test(requested)) throw HttpError.notFound(ERROR_MESSAGE.WORKSPACE_NOT_FOUND);
    const membership = await Membership.findOne({ workspace: requested, user: req.userId }).lean();
    if (!membership) throw HttpError.notFound(ERROR_MESSAGE.WORKSPACE_NOT_FOUND);
    req.workspaceId = requested;
    req.workspaceRole = membership.role;
    next();
  } catch (err) {
    next(err);
  }
};

export const can = (role: Role | undefined, action: Action) => !!role && ROLE_ACTIONS[role].includes(action);

const WHAT: Record<Action, string> = {
  [ACTION.VIEW]: 'see this board',
  [ACTION.CREATE_TASK]: 'create tasks here',
  [ACTION.EDIT_TASK]: 'change tasks here',
  [ACTION.DELETE_TASK]: 'delete tasks here',
  [ACTION.ASSIGN]: 'assign tasks here',
  [ACTION.MANAGE_BOARD]: 'change the statuses and priorities of this board',
  [ACTION.MANAGE_TEAM]: 'manage the team of this board',
};

/** Lets a request through only if the caller's role on this board allows the action. */
export const requireAction =
  (action: Action): RequestHandler =>
  (req, _res, next) => (can(req.workspaceRole, action) ? next() : next(HttpError.forbidden(ERROR_MESSAGE.NOT_ALLOWED(WHAT[action]))));
