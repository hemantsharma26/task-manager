// Starts a real mongod on 127.0.0.1:27017 without installing MongoDB or Docker.
// Data is kept in server/.mongo-data, so it survives restarts. Stop it with Ctrl+C.
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

const dbPath = path.resolve(import.meta.dirname, '../.mongo-data');
mkdirSync(dbPath, { recursive: true });

const mongod = await MongoMemoryServer.create({
  instance: { port: 27017, ip: '127.0.0.1', dbPath, storageEngine: 'wiredTiger' },
});
console.log(`MongoDB ready at ${mongod.getUri()} (data in ${dbPath})`);

const stop = async () => {
  await mongod.stop();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
