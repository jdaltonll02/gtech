import {Worker} from 'bullmq';
import {jobConnection,mediaQueue} from './modules/media/queue.js';
import {processPhoto} from './modules/media/processing.js';
import {generateDailyTopPicks,rebuildDeck} from './modules/discovery/services.js';
import {expireSubscriptions} from './modules/billing/services.js';
import {hardDeleteDueAccounts} from './modules/account/services.js';

await mediaQueue.upsertJobScheduler('subscription-expiry',{every:60_000},{name:'expire-subscriptions',data:{},opts:{removeOnComplete:100,removeOnFail:100}});
await mediaQueue.upsertJobScheduler('daily-top-picks',{pattern:'0 0 * * *'},{name:'daily-top-picks',data:{},opts:{removeOnComplete:30,removeOnFail:30}});
await mediaQueue.upsertJobScheduler('hard-delete-accounts',{every:60*60_000},{name:'hard-delete-accounts',data:{},opts:{removeOnComplete:30,removeOnFail:30}});

new Worker<{photoId?: unknown;userId?:unknown}>('pepper', async (job) => {
  if (job.name === 'process-photo') await processPhoto(String(job.data.photoId));
  else if(job.name==='rebuild-deck')await rebuildDeck(String(job.data.userId));
  else if(job.name==='expire-subscriptions')await expireSubscriptions();
  else if(job.name==='daily-top-picks')await generateDailyTopPicks();
  else if(job.name==='hard-delete-accounts')await hardDeleteDueAccounts();
  else console.info(`Ignored unknown job ${job.name}`);
}, {connection: jobConnection});
