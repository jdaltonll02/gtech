import {beforeEach,describe,expect,it,vi} from 'vitest';
import type {Preferences} from '../domain/models';

const api=vi.hoisted(()=>vi.fn());
vi.mock('../../../core/api',()=>({api}));

const {appRepository}=await import('./appRepository');

describe('app repository contracts',()=>{
  beforeEach(()=>{api.mockReset();vi.spyOn(crypto,'randomUUID').mockReturnValue('01900000-0000-7000-8000-000000000001')});

  it('maps discovery lists and submits idempotent swipe metadata',async()=>{
    api.mockResolvedValueOnce({results:[{id:'profile-1'}]}).mockResolvedValueOnce({matched:false});
    await expect(appRepository.deck()).resolves.toEqual([{id:'profile-1'}]);
    await appRepository.swipe('profile-1','like');
    expect(api).toHaveBeenNthCalledWith(1,'/discovery/deck?limit=20');
    expect(api).toHaveBeenNthCalledWith(2,'/swipes',expect.objectContaining({method:'POST',body:expect.stringContaining('"target_id":"profile-1"')}));
    expect(JSON.parse(api.mock.calls[1]![1].body as string)).toMatchObject({target_id:'profile-1',action:'like'});
  });

  it('normalizes message order and uses a client UUID when sending',async()=>{
    api.mockResolvedValueOnce({results:[{id:'newer'},{id:'older'}]}).mockResolvedValueOnce({id:'sent'});
    await expect(appRepository.messages('match-1')).resolves.toEqual([{id:'older'},{id:'newer'}]);
    await appRepository.sendMessage('match-1','Hello');
    expect(api).toHaveBeenNthCalledWith(1,'/matches/match-1/messages?limit=50');
    const request=api.mock.calls[1]![1];
    expect(JSON.parse(request.body as string)).toEqual({client_id:'01900000-0000-7000-8000-000000000001',kind:'text',body:'Hello'});
  });

  it('sends safety and match mutations to their protected endpoints',async()=>{
    api.mockResolvedValue({});
    await appRepository.markRead('match-1','message-1');
    await appRepository.unmatch('match-1');
    await appRepository.block('user-2');
    await appRepository.report('user-2','match-1','scam');
    expect(api).toHaveBeenCalledWith('/matches/match-1/read',{method:'POST',body:'{"up_to_message_id":"message-1"}'});
    expect(api).toHaveBeenCalledWith('/matches/match-1',{method:'DELETE'});
    expect(api).toHaveBeenCalledWith('/safety/blocks',{method:'POST',body:'{"user_id":"user-2"}'});
    expect(api).toHaveBeenCalledWith('/safety/reports',{method:'POST',body:'{"reported_id":"user-2","match_id":"match-1","reason":"scam","details":""}'});
  });

  it('requires explicit destructive confirmation for account deletion',async()=>{
    api.mockResolvedValue({});
    await appRepository.pause();
    await appRepository.exportData();
    await appRepository.deleteAccount();
    expect(api).toHaveBeenCalledWith('/account/pause',{method:'POST'});
    expect(api).toHaveBeenCalledWith('/account/export');
    expect(api).toHaveBeenCalledWith('/account',{method:'DELETE',body:'{"confirmation":"DELETE"}'});
  });

  it('maps products and creates a unique development receipt',async()=>{
    api.mockResolvedValueOnce({results:[{sku:'gold'}]}).mockResolvedValueOnce({});
    await expect(appRepository.products()).resolves.toEqual([{sku:'gold'}]);
    await appRepository.fakePurchase('gold');
    expect(api).toHaveBeenLastCalledWith('/billing/verify',{method:'POST',body:'{"provider":"fake","product_sku":"gold","receipt":"web-debug-01900000-0000-7000-8000-000000000001","currency":"USD"}'});
  });

  it('maps profile, preferences, notifications, likes, and match lists',async()=>{
    api
      .mockResolvedValueOnce({id:'profile'})
      .mockResolvedValueOnce({id:'updated'})
      .mockResolvedValueOnce({max_distance_km:50})
      .mockResolvedValueOnce({max_distance_km:80})
      .mockResolvedValueOnce({messages:true})
      .mockResolvedValueOnce({messages:false})
      .mockResolvedValueOnce({count:0})
      .mockResolvedValueOnce({results:[{id:'match-1'}]});
    await appRepository.profile();
    await appRepository.updateProfile({bio:'Hello'});
    await appRepository.preferences();
    await appRepository.updatePreferences({max_distance_km:80} as Preferences);
    await appRepository.notificationPreferences();
    await appRepository.updateNotifications({messages:false});
    await appRepository.likes();
    await expect(appRepository.matches()).resolves.toEqual([{id:'match-1'}]);
    expect(api).toHaveBeenCalledWith('/profiles/me',{method:'PATCH',body:'{"bio":"Hello"}'});
    expect(api).toHaveBeenCalledWith('/profiles/me/preferences',{method:'PATCH',body:'{"max_distance_km":80}'});
    expect(api).toHaveBeenCalledWith('/notifications/preferences',{method:'PATCH',body:'{"messages":false}'});
  });

  it('calls rewind and boost feature endpoints',async()=>{
    api.mockResolvedValue({});
    await appRepository.rewind();
    await appRepository.boost();
    expect(api).toHaveBeenCalledWith('/swipes/rewind',{method:'POST'});
    expect(api).toHaveBeenCalledWith('/billing/boost/activate',{method:'POST'});
  });
});
