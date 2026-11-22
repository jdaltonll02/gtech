import {beforeEach,describe,expect,it,vi} from 'vitest';
import {api,ApiError} from './api';

describe('API resilience',()=>{
  beforeEach(()=>{sessionStorage.clear();vi.unstubAllGlobals()});

  it('adds bearer authentication and returns successful JSON',async()=>{
    sessionStorage.setItem('pepper.access','access-token');
    const fetchMock=vi.fn(()=>Promise.resolve(new Response(JSON.stringify({status:'ok'}),{status:200,headers:{'Content-Type':'application/json'}})));
    vi.stubGlobal('fetch',fetchMock);
    await expect(api<{status:string}>('/profiles/me',{headers:{'X-Request-ID':'request-1'}})).resolves.toEqual({status:'ok'});
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:8000/api/v1/profiles/me',
      expect.objectContaining({headers:expect.objectContaining({Authorization:'Bearer access-token','X-Request-ID':'request-1'})}),
    );
  });

  it('rotates tokens once and retries an unauthorized protected request',async()=>{
    sessionStorage.setItem('pepper.access','expired-access');
    sessionStorage.setItem('pepper.refresh','valid-refresh');
    const fetchMock=vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({error:{code:'TOKEN_EXPIRED',message:'Expired'}}),{status:401,headers:{'Content-Type':'application/json'}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({access:'new-access',refresh:'new-refresh'}),{status:200,headers:{'Content-Type':'application/json'}}))
      .mockResolvedValueOnce(new Response(JSON.stringify({id:'profile-1'}),{status:200,headers:{'Content-Type':'application/json'}}));
    vi.stubGlobal('fetch',fetchMock);
    await expect(api<{id:string}>('/profiles/me')).resolves.toEqual({id:'profile-1'});
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(sessionStorage.getItem('pepper.access')).toBe('new-access');
    expect(sessionStorage.getItem('pepper.refresh')).toBe('new-refresh');
  });

  it('requires sign-in without attempting a refresh when no refresh token exists',async()=>{
    vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve(new Response('{}',{status:401,headers:{'Content-Type':'application/json'}}))));
    await expect(api('/profiles/me')).rejects.toMatchObject<Partial<ApiError>>({code:'AUTHENTICATION_REQUIRED',message:'Sign in to continue.'});
  });

  it('returns an empty object for a successful no-content response',async()=>{
    vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve(new Response(null,{status:204}))));
    await expect(api('/auth/logout',{method:'POST'})).resolves.toEqual({});
  });

  it('preserves a structured API error',async()=>{
    vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve(new Response(JSON.stringify({error:{code:'PERMISSION_DENIED',message:'Not allowed.',details:{scope:'match'}}}),{status:403,headers:{'Content-Type':'application/json'}}))));
    await expect(api('/matches/private')).rejects.toMatchObject<Partial<ApiError>>({code:'PERMISSION_DENIED',message:'Not allowed.',details:{scope:'match'}});
  });

  it('returns a useful offline error when fetch fails',async()=>{
    vi.stubGlobal('fetch',vi.fn(()=>Promise.reject(new TypeError('Failed to fetch'))));
    await expect(api('/profiles/me')).rejects.toMatchObject<Partial<ApiError>>({code:'NETWORK_ERROR',message:'Could not reach Pepper. Check your connection and try again.'});
  });

  it('handles a non-JSON upstream error without crashing',async()=>{
    vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve(new Response('<html>Bad gateway</html>',{status:502,headers:{'Content-Type':'text/html'}}))));
    await expect(api('/profiles/me')).rejects.toMatchObject<Partial<ApiError>>({code:'REQUEST_FAILED',message:'Request failed'});
  });
});
