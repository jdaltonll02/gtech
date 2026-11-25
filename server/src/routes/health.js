import { Router } from 'express';
import { config } from '../config.js';
import { prisma } from '../lib/prisma.js';

export const healthRouter = Router();
healthRouter.get('/health', (_request, response) => response.json({ status: 'ok', version: config.APP_VERSION }));
healthRouter.get('/health/ready', async (_request, response) => {
  try {
    await prisma.$queryRawUnsafe('SELECT 1');
    const rows=await prisma.$queryRawUnsafe("SELECT 1 FROM schema_migrations WHERE name='0036_background_jobs.sql'");
    if(!rows.length)return response.status(503).json({status:'not_ready',database:true,migrations:false});
    return response.json({status:'ready',database:true,migrations:true,version:config.APP_VERSION});
  } catch {
    return response.status(503).json({status:'not_ready',database:false,migrations:false});
  }
});
