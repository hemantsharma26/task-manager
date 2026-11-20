import { Schema, model, type InferSchemaType } from 'mongoose';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    // Stored lowercase so the unique index is effectively case-insensitive.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema> & { _id: Schema.Types.ObjectId };

export const User = model('User', userSchema);

export const toUserDTO = (u: { _id: unknown; name: string; email: string; createdAt: Date }) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  createdAt: u.createdAt,
});
