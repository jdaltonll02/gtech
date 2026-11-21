import {Queue} from 'bullmq';
import {config} from '../../config.js';

const redisUrl = new URL(config.REDIS_URL);
export const jobConnection = {host: redisUrl.hostname, port: Number(redisUrl.port || 6379), ...(redisUrl.password ? {password: redisUrl.password} : {})};
export const mediaQueue = new Queue('pepper', {connection: jobConnection});
