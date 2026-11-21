import {beforeEach,describe,expect,it,vi} from 'vitest';
import {api,ApiError} from './api';

describe('API resilience',()=>{
  beforeEach(()=>sessionStorage.clear());

  it('returns a useful offline error when fetch fails',async()=>{
    vi.stubGlobal('fetch',vi.fn(()=>Promise.reject(new TypeError('Failed to fetch'))));
    await expect(api('/profiles/me')).rejects.toMatchObject<Partial<ApiError>>({code:'NETWORK_ERROR',message:'Could not reach Pepper. Check your connection and try again.'});
  });

  it('handles a non-JSON upstream error without crashing',async()=>{
    vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve(new Response('<html>Bad gateway</html>',{status:502,headers:{'Content-Type':'text/html'}}))));
    await expect(api('/profiles/me')).rejects.toMatchObject<Partial<ApiError>>({code:'REQUEST_FAILED',message:'Request failed'});
  });
});
