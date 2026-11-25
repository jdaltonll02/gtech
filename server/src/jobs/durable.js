import { randomUUID } from 'node:crypto';
import { prisma } from '../lib/prisma.js';

export async function enqueueDurable(name,payload,{db=prisma,maxAttempts=5,runAt=null}={}){
  const id=randomUUID();
  await db.$executeRawUnsafe("INSERT INTO background_jobs(id,name,payload,status,attempts,max_attempts,run_at,created_at) VALUES($1::uuid,$2,$3::jsonb,'pending',0,$4,COALESCE($5::timestamptz,NOW()),NOW())",id,name,JSON.stringify(payload??{}),maxAttempts,runAt);
  return id;
}

async function claim(){
  return prisma.$transaction(async(tx)=>{
    const rows=await tx.$queryRawUnsafe("SELECT * FROM background_jobs WHERE ((status='pending' AND run_at<=NOW()) OR (status='running' AND locked_at<NOW()-INTERVAL '15 minutes')) ORDER BY run_at,created_at FOR UPDATE SKIP LOCKED LIMIT 1");
    if(!rows.length)return null;
    const job=rows[0];
    await tx.$executeRawUnsafe("UPDATE background_jobs SET status='running',locked_at=NOW(),attempts=attempts+1 WHERE id=$1::uuid",String(job.id));
    return{...job,attempts:job.attempts+1};
  });
}

export function startDurableWorker(handlers,{pollMs=1000,logger=console}={}){
  let stopped=false,running=false,timer=null;
  const schedule=()=>{if(!stopped)timer=setTimeout(tick,pollMs);};
  const tick=async()=>{
    if(stopped||running)return schedule();
    running=true;
    try{
      const job=await claim();
      if(job){
        const handler=handlers[job.name];
        if(!handler)throw new Error(`No handler registered for durable job ${job.name}`);
        try{
          await handler(job.payload);
          await prisma.$executeRawUnsafe("UPDATE background_jobs SET status='completed',completed_at=NOW(),locked_at=NULL,last_error=NULL WHERE id=$1::uuid",String(job.id));
        }catch(error){
          const failed=job.attempts>=job.max_attempts;
          await prisma.$executeRawUnsafe("UPDATE background_jobs SET status=$1,run_at=CASE WHEN $1='pending' THEN NOW()+($2||' seconds')::interval ELSE run_at END,locked_at=NULL,last_error=$3 WHERE id=$4::uuid",failed?'failed':'pending',Math.min(3600,30*(2**Math.max(0,job.attempts-1))),String(error.message??error).slice(0,4000),String(job.id));
          logger.error('Durable job failed',{job:job.name,id:String(job.id),attempt:job.attempts,failed,message:error.message});
        }
      }
    }catch(error){logger.error('Durable worker poll failed',{message:error.message});}
    finally{running=false;schedule();}
  };
  schedule();
  return{stop(){stopped=true;if(timer)clearTimeout(timer);}};
}
