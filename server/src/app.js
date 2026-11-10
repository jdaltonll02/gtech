import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
import { healthRouter } from './routes/health.js';
import { authRouter } from './routes/auth.js';
import { rbacRouter } from './routes/rbac.js';
import { portfolioRouter } from './routes/portfolio.js';
import { blogRouter } from './routes/blog.js';
import { partnersRouter } from './routes/partners.js';
import { corsMiddleware, globalLimiter, permissionsPolicy, securityHeaders } from './middleware/security.js';
import { errorHandler, notFound } from './middleware/errors.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '../..');

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(securityHeaders, permissionsPolicy, corsMiddleware, globalLimiter);

  // The Stripe webhook router is mounted here before JSON parsing when ported.
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: false }));
  app.use(healthRouter);
  app.use('/api/v1/auth', authRouter);
  app.use('/api/v1/rbac', rbacRouter);
  app.use('/api/v1/portfolio', portfolioRouter);
  app.use('/api/v1/blog', blogRouter);
  app.use('/api/v1/partners', partnersRouter);
  app.use('/media', express.static(path.resolve(projectRoot, config.LOCAL_MEDIA_ROOT), { fallthrough: false }));

  const frontendDist = path.resolve(projectRoot, 'frontend/dist');
  app.use(express.static(frontendDist));
  app.get(/^(?!\/api\/|\/media(?:\/|$)|\/health$).*/, (_request, response) => response.sendFile(path.join(frontendDist, 'index.html')));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}
