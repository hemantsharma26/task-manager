import path from 'node:path';
import { existsSync } from 'node:fs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env, isProd } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.routes.js';
import { taskRouter } from './routes/task.routes.js';
import { logger } from './utils/logger.js';

export function createApp() {
  const app = express();

  // Behind nginx / a load balancer in production, so req.ip (rate limiting) is the real client.
  if (isProd) app.set('trust proxy', 1);

  app.use(
    helmet({
      // TLS is terminated by the reverse proxy, which is where HSTS belongs. Sending it (or
      // upgrade-insecure-requests) from here would break anyone running the app over plain http.
      strictTransportSecurity: false,
      contentSecurityPolicy: { directives: { 'upgrade-insecure-requests': null } },
    }),
  );
  app.use(
    pinoHttp({
      logger,
      autoLogging: { ignore: (req) => req.url === '/api/health' },
      // Keep one short line per request instead of dumping every header.
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  if (!isProd) app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/tasks', taskRouter);
  app.use('/api', notFoundHandler);

  // In production the API also serves the built React app, so the whole product is a
  // single origin: no CORS, and the auth cookie stays first-party.
  const clientDist = path.resolve(import.meta.dirname, '../../client/dist');
  if (isProd && existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
