import { User } from './user.model.js';

export const userRepository = {
  create: (data: { name: string; email: string; passwordHash: string }) => User.create(data),
  findByEmailWithPassword: (email: string) => User.findOne({ email }).select('+passwordHash'),
  findByIdWithPassword: (id: string) => User.findById(id).select('+passwordHash'),
  findById: (id: string) => User.findById(id),
  findByEmail: (email: string) => User.findOne({ email }),
  findManyByIds: (ids: string[]) => User.find({ _id: { $in: ids } }).select('name email').lean(),
};
