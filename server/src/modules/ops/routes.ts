import {Router} from 'express';
import {createClient} from 'redis';
import {config} from '../../config.js';
import {pool} from '../../db/pool.js';

export const opsRouter = Router();
opsRouter.get('/healthz', (_request, response) => response.json({status: 'ok'}));
opsRouter.get('/readyz', async (_request, response) => {
  const readiness = {db: 'error', redis: 'error'};
  try { await pool.query('SELECT 1'); readiness.db = 'ok'; } catch (error) { console.warn('Readiness database check failed', error); }
  const redis = createClient({url: config.REDIS_URL});
  try { await redis.connect(); await redis.ping(); readiness.redis = 'ok'; } catch (error) { console.warn('Readiness Redis check failed', error); } finally { if (redis.isOpen) await redis.disconnect(); }
  response.status(Object.values(readiness).every((value) => value === 'ok') ? 200 : 503).json(readiness);
});
