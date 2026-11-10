import cron from 'node-cron';
import { cleanupOrphanedMedia } from './media.js';
import { cancelStaleOrders } from './orders.js';
import { cleanupExpired } from '../lib/kv.js';

const key=Symbol.for('gtech.scheduler');
export function startScheduler(){if(globalThis[key])return globalThis[key];const tasks=[cron.schedule('0 0 * * *',()=>cleanupOrphanedMedia().catch((error)=>console.error('cleanup_orphaned_media failed',error)),{timezone:'UTC'}),cron.schedule('0 * * * *',()=>Promise.all([cancelStaleOrders(),cleanupExpired()]).catch((error)=>console.error('hourly maintenance failed',error)),{timezone:'UTC'})];globalThis[key]={stop(){for(const task of tasks)task.stop();delete globalThis[key];}};return globalThis[key];}
