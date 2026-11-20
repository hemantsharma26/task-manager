import mongoose from 'mongoose';
import { LOG_MESSAGE, SERVER } from '../../constants/index.js';
import { logger } from '../logger.js';

export async function connectDb(uri: string) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { serverSelectionTimeoutMS: SERVER.DB_SERVER_SELECTION_TIMEOUT_MS });
  // Build indexes up front so the unique indexes exist before the first write.
  await mongoose.connection.syncIndexes();
  logger.info(LOG_MESSAGE.DB_CONNECTED);
}

export const disconnectDb = () => mongoose.disconnect();
