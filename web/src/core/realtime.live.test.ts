// @vitest-environment node

import {afterEach,expect,it} from 'vitest';
import {RealtimeService,type RealtimeEvent} from './realtime';

const runtimeEnv=(globalThis as typeof globalThis&{
  process?:{env:Record<string,string|undefined>};
}).process?.env??{};
const accessToken=runtimeEnv.PEPPER_E2E_ACCESS_TOKEN;
const apiBaseUrl=runtimeEnv.PEPPER_E2E_API_BASE_URL??'http://localhost:8000';
const liveTest=accessToken?it:it.skip;
let service:RealtimeService|undefined;

afterEach(()=>{
  service?.close();
  service=undefined;
});

liveTest('connects the production web realtime client and completes live HTTP synchronization',async()=>{
  service=new RealtimeService({
    baseUrl:apiBaseUrl,
    accessToken:()=>accessToken!,
  });

  const synchronized=new Promise<RealtimeEvent>((resolve,reject)=>{
    const timeout=setTimeout(
      ()=>reject(new Error('Timed out waiting for realtime synchronization.')),
      10_000,
    );
    service!.subscribe(event=>{
      if(event.type==='sync.completed'){
        clearTimeout(timeout);
        resolve(event);
      }
    });
  });

  service.connect();
  const event=await synchronized;
  expect(event.data).toMatchObject({
    matches:expect.any(Array),
    messages:expect.any(Array),
    removals:expect.any(Array),
    synced_at:expect.any(String),
  });
});
