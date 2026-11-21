import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import { pinoHttp } from 'pino-http';
import { env, isProd } from './config/env.js';
import { CACHE_CONTROL, CLIENT_BUILD, CONTENT_TYPE_JSON, HEADER, HEALTH_STATUS, HTTP_METHOD, ROUTE, SERVER, TEAM_HEADER } from './constants/index.js';
import { logger } from './infra/logger.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { columnRouter } from './modules/columns/columns.routes.js';
import { priorityRouter } from './modules/priorities/priorities.routes.js';
import { invitationRouter, teamRouter, workspaceRouter } from './modules/team/team.routes.js';
import { taskRouter } from './modules/tasks/tasks.routes.js';
import { apiCacheHeaders } from './shared/middleware/cache-headers.js';
import { errorHandler, notFoundHandler } from './shared/middleware/error-handler.js';
import { originGuard } from './shared/middleware/origin-guard.js';
import { apiRateLimit } from './shared/middleware/rate-limit.js';
import { rejectOperatorKeys } from './shared/middleware/reject-operator-keys.js';
import { requireJson } from './shared/middleware/require-json.js';
import { securityHeaders } from './shared/middleware/security-headers.js';

/**
 * The order below is deliberate. A request is made safe step by step before any route code sees it:
 *   1. who is asking (real client IP), 2. what the browser may do with the response (security headers), 3. logging,
 *   4. CORS in development, 5. compression, 6. the body: must be JSON, size-limited, parsed, 7. cookies,
 *   8. rejection of operator / prototype keys, 9. cross-site write check, 10. rate limiting, 11. cache headers.
 */
export function createApp() {
  const app = express();

  // Behind nginx / a load balancer in production, so req.ip (rate limiting, lockouts) is the real client.
  if (isProd) app.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.use(securityHeaders);
  app.use(
    pinoHttp({
      logger,
      // A fresh id per request, never one supplied by the client (which could be used to forge log lines).
      genReqId: (_req, res) => {
        const id = randomUUID();
        res.setHeader(HEADER.REQUEST_ID, id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === `${ROUTE.API}${ROUTE.HEALTH}` },
      // One short line per request, never headers (cookies!) or bodies (passwords!).
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url?.split('?')[0] }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );
  if (!isProd) {
    app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true, methods: Object.values(HTTP_METHOD), allowedHeaders: [HEADER.CONTENT_TYPE, TEAM_HEADER.WORKSPACE_ID], maxAge: 600 }));
  }
  // JSON compresses ~5-10x, which matters most for the board (several lists per page load).
  app.use(compression());

  app.use(ROUTE.API, requireJson);
  // Sign-in and register bodies are tiny; a 4 kB cap there stops anyone using them to push megabytes at the hashing code.
  app.use(`${ROUTE.API}${ROUTE.AUTH.BASE}`, express.json({ limit: SERVER.AUTH_JSON_BODY_LIMIT, strict: true, type: CONTENT_TYPE_JSON }));
  app.use(express.json({ limit: SERVER.JSON_BODY_LIMIT, strict: true, type: CONTENT_TYPE_JSON }));
  app.use(cookieParser());

  app.use(ROUTE.API, rejectOperatorKeys, originGuard, apiRateLimit, apiCacheHeaders);

  app.get(`${ROUTE.API}${ROUTE.HEALTH}`, (_req, res) => {
    res.json({ status: HEALTH_STATUS.OK });
  });
  app.use(`${ROUTE.API}${ROUTE.AUTH.BASE}`, authRouter);
  app.use(`${ROUTE.API}${ROUTE.TASKS.BASE}`, taskRouter);
  app.use(`${ROUTE.API}${ROUTE.COLUMNS.BASE}`, columnRouter);
  app.use(`${ROUTE.API}${ROUTE.PRIORITIES.BASE}`, priorityRouter);
  app.use(`${ROUTE.API}${ROUTE.TEAM.BASE}`, teamRouter);
  app.use(`${ROUTE.API}${ROUTE.INVITATIONS.BASE}`, invitationRouter);
  app.use(`${ROUTE.API}${ROUTE.WORKSPACES.BASE}`, workspaceRouter);
  app.use(ROUTE.API, notFoundHandler);

  // In production the API also serves the built React app, so the whole product is a
  // single origin: no CORS, and the auth cookies stay first-party.
  const clientDist = path.resolve(import.meta.dirname, CLIENT_BUILD.DIR);
  if (isProd && existsSync(clientDist)) {
    // Vite fingerprints everything in /assets (the hash changes with the content), so those files can be cached
    // for a year. index.html is the entry point that names them, so it must always be revalidated.
    app.use(
      express.static(clientDist, {
        index: false,
        setHeaders: (res, filePath) => {
          res.setHeader(HEADER.CACHE_CONTROL, filePath.includes(`${path.sep}${CLIENT_BUILD.ASSETS_DIR}${path.sep}`) ? CACHE_CONTROL.IMMUTABLE_ONE_YEAR : CACHE_CONTROL.REVALIDATE);
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
