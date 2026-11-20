import { Schema, model } from 'mongoose';
import { MODEL, NAME_LIMITS } from '../../constants/index.js';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: NAME_LIMITS.MAX },
    // Stored lowercase so the unique index is effectively case-insensitive.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true, select: false },
  },
  { timestamps: true },
);

export const User = model(MODEL.USER, userSchema);
