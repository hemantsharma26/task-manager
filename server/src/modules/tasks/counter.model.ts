import { Schema, model } from 'mongoose';
import { MODEL } from '../../constants/index.js';

// One document per user holds the last issue number handed out (TM-1, TM-2, ...).
// $inc on a single document is atomic, so concurrent creates never get the same number.
const counterSchema = new Schema<{ _id: string; seq: number }>({ _id: String, seq: { type: Number, default: 0 } }, { versionKey: false });

export const Counter = model(MODEL.COUNTER, counterSchema);

export async function nextIssueNumber(ownerId: string): Promise<number> {
  const doc = await Counter.findOneAndUpdate({ _id: ownerId }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: 'after' });
  return doc.seq;
}
