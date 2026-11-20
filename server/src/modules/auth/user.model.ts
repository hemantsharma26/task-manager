import { Schema, model } from 'mongoose';
import { EMAIL_LIMITS, MODEL, NAME_LIMITS } from '../../constants/index.js';

const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: NAME_LIMITS.MAX },
    // Stored lowercase so the unique index is effectively case-insensitive.
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: EMAIL_LIMITS.MAX },
    // select: false keeps the hash out of every query unless it is asked for by name.
    passwordHash: { type: String, required: true, select: false },
    passwordChangedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const User = model(MODEL.USER, userSchema);
