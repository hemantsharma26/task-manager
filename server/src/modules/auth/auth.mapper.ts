export const toUserDTO = (u: { _id: unknown; name: string; email: string; createdAt: Date }) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  createdAt: u.createdAt,
});
