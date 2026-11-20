import path from 'node:path';
import { existsSync } from 'node:fs';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env, isProd } from './config/env.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './routes/auth.routes.js';
import { columnRouter } from './routes/column.routes.js';
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
  // JSON compresses ~5-10x, which matters most for the board (several lists per page load).
  app.use(compression());
  app.use(express.json({ limit: '50kb' }));
  app.use(cookieParser());

  // A generous ceiling per client; the auth routes have their own, much stricter limiter.
  app.use(
    '/api',
    rateLimit({
      windowMs: 60_000,
      limit: 600,
      standardHeaders: 'draft-7',
      legacyHeaders: false,
      skip: (req) => env.NODE_ENV === 'test' || req.path === '/health',
      message: { error: { code: 'RATE_LIMITED', message: 'Too many requests, slow down a little' } },
    }),
  );

  // API responses are per-user, so shared caches (CDN, proxy) must never keep them. "no-cache" does not
  // mean "do not cache": the browser may store the response but must revalidate every time. Express adds an
  // ETag to each JSON body, so an unchanged list comes back as an empty 304 instead of the full payload.
  app.use('/api', (req, res, next) => {
    if (req.method === 'GET' && req.path !== '/health') {
      res.set('Cache-Control', 'private, no-cache');
      res.vary('Cookie');
    }
    next();
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  app.use('/api/auth', authRouter);
  app.use('/api/tasks', taskRouter);
  app.use('/api/columns', columnRouter);
  app.use('/api', notFoundHandler);

  // In production the API also serves the built React app, so the whole product is a
  // single origin: no CORS, and the auth cookie stays first-party.
  const clientDist = path.resolve(import.meta.dirname, '../../client/dist');
  if (isProd && existsSync(clientDist)) {
    // Vite fingerprints everything in /assets (the hash changes with the content), so those files can be cached
    // for a year. index.html is the entry point that names them, so it must always be revalidated.
    app.use(
      express.static(clientDist, {
        index: false,
        setHeaders: (res, filePath) => {
          res.setHeader(
            'Cache-Control',
            filePath.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache',
          );
        },
      }),
    );
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.set('Cache-Control', 'no-cache');
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
