import {createClient} from 'redis';
import {config} from '../config.js';

export const redisClient=createClient({url:config.REDIS_URL});
redisClient.on('error',(error)=>console.warn('Redis client error',error));
let connecting:Promise<unknown>|undefined;
export const getRedis=async()=>{
  if(!redisClient.isOpen){connecting??=redisClient.connect().finally(()=>{connecting=undefined;});await connecting;}
  return redisClient;
};
