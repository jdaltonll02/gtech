import {beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>{const client={release:vi.fn()};return{client,connect:vi.fn(),claimLog:vi.fn(),preferences:vi.fn(),deviceTokens:vi.fn(),finishLog:vi.fn()};});
vi.mock('../src/db/pool.js',()=>({pool:{connect:mocks.connect}}));
vi.mock('../src/modules/notifications/repositories.js',()=>({notificationRepository:{claimLog:mocks.claimLog,preferences:mocks.preferences,deviceTokens:mocks.deviceTokens,finishLog:mocks.finishLog}}));
const {setPushProviderForTests}=await import('../src/modules/notifications/providers.js');
const {sendPush}=await import('../src/modules/notifications/services.js');

describe('push notifications',()=>{
  beforeEach(()=>{vi.clearAllMocks();mocks.connect.mockResolvedValue(mocks.client);mocks.claimLog.mockResolvedValue({id:'log-id'});mocks.preferences.mockResolvedValue(null);mocks.deviceTokens.mockResolvedValue(['device-token']);});
  it('calls the provider for an enabled offline notification',async()=>{const send=vi.fn().mockResolvedValue(undefined);setPushProviderForTests({name:'fake',send});await expect(sendPush({userId:'user-id',kind:'messages',dedupKey:'message:1',title:'Sender',body:'Hello',data:{type:'message.new'}})).resolves.toBe(true);expect(send).toHaveBeenCalledWith(expect.objectContaining({tokens:['device-token'],body:'Hello'}));expect(mocks.finishLog).toHaveBeenCalledWith(mocks.client,'log-id','sent');});
  it('deduplicates an already claimed notification',async()=>{const send=vi.fn().mockResolvedValue(undefined);setPushProviderForTests({name:'fake',send});mocks.claimLog.mockResolvedValue(undefined);await expect(sendPush({userId:'user-id',kind:'likes',dedupKey:'likes:5',title:'Likes',body:'Five likes',data:{}})).resolves.toBe(false);expect(send).not.toHaveBeenCalled();});
});
