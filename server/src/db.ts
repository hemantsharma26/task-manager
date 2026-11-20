import mongoose from 'mongoose';
import { logger } from './utils/logger.js';

export async function connectDb(uri: string) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  // Build indexes up front so the unique email index exists before the first signup.
  await mongoose.connection.syncIndexes();
  logger.info('MongoDB connected');
}

export const disconnectDb = () => mongoose.disconnect();
