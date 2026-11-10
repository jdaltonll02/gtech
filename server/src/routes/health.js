import { Router } from 'express';
import { config } from '../config.js';

export const healthRouter = Router();
healthRouter.get('/health', (_request, response) => response.json({ status: 'ok', version: config.APP_VERSION }));
