import { isValidObjectId } from 'mongoose';
import type { MemberRole } from '../../constants/index.js';
import { Invitation } from './invitation.model.js';
import { Membership } from './membership.model.js';

export const teamRepository = {
  // ----- members
  findMembers: (workspaceId: string) => Membership.find({ workspace: workspaceId }).sort({ createdAt: 1 }).lean(),
  findMembership: (workspaceId: string, userId: string) => Membership.findOne({ workspace: workspaceId, user: userId }),
  countMembers: (workspaceId: string) => Membership.countDocuments({ workspace: workspaceId }),
  addMember: (workspaceId: string, userId: string, role: MemberRole) => Membership.create({ workspace: workspaceId, user: userId, role }),
  removeMember: (workspaceId: string, userId: string) => Membership.deleteOne({ workspace: workspaceId, user: userId }),
  findMembershipsOfUser: (userId: string) => Membership.find({ user: userId }).sort({ createdAt: 1 }).lean(),

  // ----- invitations
  createInvitation: (data: { workspace: string; email: string; role: MemberRole; invitedBy: string; tokenHash: string; expiresAt: Date }) => Invitation.create(data),
  findInvitationByHash: (tokenHash: string) => Invitation.findOne({ tokenHash }),
  findPending: (workspaceId: string) => Invitation.find({ workspace: workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } }).sort({ createdAt: -1 }).lean(),
  countPending: (workspaceId: string) => Invitation.countDocuments({ workspace: workspaceId, acceptedAt: null, revokedAt: null, expiresAt: { $gt: new Date() } }),
  /** A new invitation to the same address replaces any earlier open one, so only the newest link works. */
  revokePendingFor: (workspaceId: string, email: string) => Invitation.updateMany({ workspace: workspaceId, email, acceptedAt: null, revokedAt: null }, { $set: { revokedAt: new Date() } }),
  async findInvitationOwned(workspaceId: string, id: string) {
    if (!isValidObjectId(id)) return null;
    return Invitation.findOne({ _id: id, workspace: workspaceId });
  },
};
