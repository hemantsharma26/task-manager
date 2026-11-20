import { createApp } from './app.js';
import { env, publicConfig } from './config/env.js';
import { CONFIG_LOADED, LOG_MESSAGE, SERVER, SIGNAL } from './constants/index.js';
import { cache } from './infra/cache/index.js';
import { connectDb, disconnectDb } from './infra/database/connection.js';
import { logger } from './infra/logger.js';

async function main() {
  logger.info(publicConfig(), CONFIG_LOADED);
  await connectDb(env.MONGODB_URI);
  const server = createApp().listen(env.PORT, () => {
    logger.info(LOG_MESSAGE.LISTENING(env.PORT));
  });
  // Slow-client protection ("slowloris"): headers and the whole request must arrive in a sensible time, and idle
  // keep-alive connections are closed, so a handful of dribbling sockets cannot hold the server hostage.
  server.headersTimeout = SERVER.HEADERS_TIMEOUT_MS;
  server.requestTimeout = SERVER.REQUEST_TIMEOUT_MS;
  server.keepAliveTimeout = SERVER.KEEP_ALIVE_TIMEOUT_MS;

  const shutdown = (signal: string) => {
    logger.info(LOG_MESSAGE.SHUTDOWN(signal));
    server.close(async () => {
      await Promise.allSettled([disconnectDb(), cache.close()]);
      process.exit(0);
    });
    // Don't hang forever on a stuck keep-alive connection.
    setTimeout(() => process.exit(1), SERVER.SHUTDOWN_TIMEOUT_MS).unref();
  };
  process.on(SIGNAL.SIGTERM, () => shutdown(SIGNAL.SIGTERM));
  process.on(SIGNAL.SIGINT, () => shutdown(SIGNAL.SIGINT));
}

main().catch((err) => {
  logger.error({ err }, LOG_MESSAGE.START_FAILED);
  process.exit(1);
});
