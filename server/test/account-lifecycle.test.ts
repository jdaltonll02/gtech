import {beforeEach,describe,expect,it,vi} from 'vitest';

const mocks=vi.hoisted(()=>{
  const client={query:vi.fn(),release:vi.fn()};
  return{
    client,
    connect:vi.fn(),
    setStatus:vi.fn(),
    setDiscoverable:vi.fn(),
    cancelDeletion:vi.fn(),
    revokeTokens:vi.fn(),
    requestDeletion:vi.fn(),
    removeMatches:vi.fn(),
    exportData:vi.fn(),
    addExport:vi.fn(),
    dueDeletions:vi.fn(),
    storageKeys:vi.fn(),
    hardDelete:vi.fn(),
    uploadObject:vi.fn(),
    createDownloadUrl:vi.fn(),
    deleteObjects:vi.fn(),
    redisDel:vi.fn(),
    redisLRem:vi.fn(),
    emitToUser:vi.fn(),
  };
});

vi.mock('../src/db/pool.js',()=>({pool:{connect:mocks.connect}}));
vi.mock('../src/modules/account/repositories.js',()=>({lifecycleRepository:{
  setStatus:mocks.setStatus,
  setDiscoverable:mocks.setDiscoverable,
  cancelDeletion:mocks.cancelDeletion,
  revokeTokens:mocks.revokeTokens,
  requestDeletion:mocks.requestDeletion,
  removeMatches:mocks.removeMatches,
  exportData:mocks.exportData,
  addExport:mocks.addExport,
  dueDeletions:mocks.dueDeletions,
  storageKeys:mocks.storageKeys,
  hardDelete:mocks.hardDelete,
}}));
vi.mock('../src/modules/media/storage.js',()=>({
  uploadObject:mocks.uploadObject,
  createDownloadUrl:mocks.createDownloadUrl,
  deleteObjects:mocks.deleteObjects,
}));
vi.mock('../src/modules/realtime/gateway.js',()=>({emitToUser:mocks.emitToUser}));
vi.mock('../src/core/redis.js',()=>({getRedis:vi.fn(()=>Promise.resolve({
  del:mocks.redisDel,
  lRem:mocks.redisLRem,
  scanIterator:()=>({async *[Symbol.asyncIterator](){await Promise.resolve();yield 'deck:other-user';}}),
}))}));

const {deleteAccount,exportAccount,hardDeleteDueAccounts,pauseAccount,resumeAccount}=await import('../src/modules/account/services.js');

describe('account lifecycle services',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    mocks.connect.mockResolvedValue(mocks.client);
    mocks.client.query.mockResolvedValue({rows:[]});
    mocks.setStatus.mockResolvedValue({id:'user-id',status:'active'});
    mocks.removeMatches.mockResolvedValue([]);
    mocks.dueDeletions.mockResolvedValue([]);
    mocks.createDownloadUrl.mockResolvedValue('https://objects.test/export');
  });

  it('pauses an account transactionally and removes it from cached decks',async()=>{
    await expect(pauseAccount('user-id')).resolves.toEqual({status:'paused'});
    expect(mocks.setStatus).toHaveBeenCalledWith(mocks.client,'user-id','paused');
    expect(mocks.setDiscoverable).toHaveBeenCalledWith(mocks.client,'user-id',false);
    expect(mocks.redisDel).toHaveBeenCalledWith(['deck:user-id','dealt:user-id','entitlements:user-id']);
    expect(mocks.redisLRem).toHaveBeenCalledWith('deck:other-user',0,'user-id');
    expect(mocks.client.query).toHaveBeenCalledWith('COMMIT');
    expect(mocks.client.release).toHaveBeenCalledOnce();
  });

  it('rolls back when a terminal account cannot be paused',async()=>{
    mocks.setStatus.mockResolvedValue(null);
    await expect(pauseAccount('user-id')).rejects.toMatchObject({code:'ACCOUNT_STATE_INVALID'});
    expect(mocks.client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mocks.setDiscoverable).not.toHaveBeenCalled();
  });

  it('resumes discovery and cancels a pending deletion',async()=>{
    await expect(resumeAccount('user-id')).resolves.toEqual({status:'active'});
    expect(mocks.setDiscoverable).toHaveBeenCalledWith(mocks.client,'user-id',true);
    expect(mocks.cancelDeletion).toHaveBeenCalledWith(mocks.client,'user-id');
    expect(mocks.client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('exports account data to a private signed object',async()=>{
    mocks.exportData.mockResolvedValue({account:{id:'user-id'},messages:[{body:'hello'}]});
    await expect(exportAccount('user-id')).resolves.toEqual({download_url:'https://objects.test/export',expires_in:900});
    expect(mocks.uploadObject).toHaveBeenCalledWith(
      expect.stringMatching(/^account-exports\/user-id\/.+\.json$/),
      expect.any(Buffer),
      'application/json',
    );
    const body=mocks.uploadObject.mock.calls[0]?.[1] as Buffer;
    expect(JSON.parse(body.toString())).toMatchObject({account:{id:'user-id'},messages:[{body:'hello'}]});
    expect(mocks.addExport).toHaveBeenCalledOnce();
  });

  it('rejects export for a missing account and releases the client',async()=>{
    mocks.exportData.mockResolvedValue({account:null});
    await expect(exportAccount('missing')).rejects.toMatchObject({code:'ACCOUNT_NOT_FOUND'});
    expect(mocks.uploadObject).not.toHaveBeenCalled();
    expect(mocks.client.release).toHaveBeenCalledOnce();
  });

  it('deletes immediately visible state and notifies both match participants',async()=>{
    const removed={id:'match-id',user_a_id:'user-id',user_b_id:'other-id',unmatched_at:new Date('2026-11-22T00:00:00Z')};
    mocks.removeMatches.mockResolvedValue([removed]);
    const result=await deleteAccount('user-id');
    expect(result.status).toBe('deleted');
    expect(new Date(result.hard_delete_at).getTime()).toBeGreaterThan(Date.now()+29*86_400_000);
    expect(mocks.revokeTokens).toHaveBeenCalledWith(mocks.client,'user-id');
    expect(mocks.requestDeletion).toHaveBeenCalledWith(mocks.client,'user-id');
    expect(mocks.emitToUser).toHaveBeenCalledTimes(2);
    expect(mocks.emitToUser).toHaveBeenCalledWith('other-id','match.removed',expect.objectContaining({match_id:'match-id'}));
  });

  it('hard-deletes due accounts and their stored objects in one transaction',async()=>{
    mocks.dueDeletions.mockResolvedValue([{user_id:'first'},{user_id:'second'}]);
    mocks.storageKeys.mockImplementation((_client:unknown,userId:string)=>Promise.resolve([`${userId}/photo.webp`]));
    await expect(hardDeleteDueAccounts()).resolves.toBe(2);
    expect(mocks.deleteObjects).toHaveBeenNthCalledWith(1,['first/photo.webp']);
    expect(mocks.deleteObjects).toHaveBeenNthCalledWith(2,['second/photo.webp']);
    expect(mocks.hardDelete).toHaveBeenCalledTimes(2);
    expect(mocks.client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('rolls back hard deletion if object removal fails',async()=>{
    mocks.dueDeletions.mockResolvedValue([{user_id:'user-id'}]);
    mocks.storageKeys.mockResolvedValue(['broken-key']);
    mocks.deleteObjects.mockRejectedValue(new Error('storage unavailable'));
    await expect(hardDeleteDueAccounts()).rejects.toThrow('storage unavailable');
    expect(mocks.hardDelete).not.toHaveBeenCalled();
    expect(mocks.client.query).toHaveBeenCalledWith('ROLLBACK');
  });
});
