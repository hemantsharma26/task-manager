import { existsSync } from 'node:fs';
import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { env, isProd } from './config/env.js';
import { CACHE_CONTROL, CLIENT_BUILD, HEADER, HEALTH_STATUS, ROUTE, SERVER } from './constants/index.js';
import { logger } from './infra/logger.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { columnRouter } from './modules/columns/columns.routes.js';
import { taskRouter } from './modules/tasks/tasks.routes.js';
import { apiCacheHeaders } from './shared/middleware/cache-headers.js';
import { errorHandler, notFoundHandler } from './shared/middleware/error-handler.js';
import { apiRateLimit } from './shared/middleware/rate-limit.js';

export function createApp() {
  const app = express();

  // Behind nginx / a load balancer in production, so req.ip (rate limiting) is the real client.
  if (isProd) app.set('trust proxy', env.TRUST_PROXY_HOPS);

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
      autoLogging: { ignore: (req) => req.url === `${ROUTE.API}${ROUTE.HEALTH}` },
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
  app.use(express.json({ limit: SERVER.JSON_BODY_LIMIT }));
  app.use(cookieParser());

  app.use(ROUTE.API, apiRateLimit, apiCacheHeaders);

  app.get(`${ROUTE.API}${ROUTE.HEALTH}`, (_req, res) => {
    res.json({ status: HEALTH_STATUS.OK });
  });
  app.use(`${ROUTE.API}${ROUTE.AUTH.BASE}`, authRouter);
  app.use(`${ROUTE.API}${ROUTE.TASKS.BASE}`, taskRouter);
  app.use(`${ROUTE.API}${ROUTE.COLUMNS.BASE}`, columnRouter);
  app.use(ROUTE.API, notFoundHandler);

  // In production the API also serves the built React app, so the whole product is a
  // single origin: no CORS, and the auth cookie stays first-party.
  const clientDist = path.resolve(import.meta.dirname, CLIENT_BUILD.DIR);
  if (isProd && existsSync(clientDist)) {
    // Vite fingerprints everything in /assets (the hash changes with the content), so those files can be cached
    // for a year. index.html is the entry point that names them, so it must always be revalidated.
    app.use(
      express.static(clientDist, {
        index: false,
        setHeaders: (res, filePath) => {
          res.setHeader(
            HEADER.CACHE_CONTROL,
            filePath.includes(`${path.sep}${CLIENT_BUILD.ASSETS_DIR}${path.sep}`) ? CACHE_CONTROL.IMMUTABLE_ONE_YEAR : CACHE_CONTROL.REVALIDATE,
          );
        },
      }),
    );
    app.get(CLIENT_BUILD.API_PREFIX_PATTERN, (_req, res) => {
      res.set(HEADER.CACHE_CONTROL, CACHE_CONTROL.REVALIDATE);
      res.sendFile(path.join(clientDist, CLIENT_BUILD.INDEX));
    });
  }

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
