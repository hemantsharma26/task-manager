import { User } from './user.model.js';

export const userRepository = {
  create: (data: { name: string; email: string; passwordHash: string }) => User.create(data),
  findByEmailWithPassword: (email: string) => User.findOne({ email }).select('+passwordHash'),
  findByIdWithPassword: (id: string) => User.findById(id).select('+passwordHash'),
  findById: (id: string) => User.findById(id),
};
