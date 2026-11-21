import {beforeEach,describe,expect,it,vi} from 'vitest';
import {AppError} from '../src/core/errors.js';

const mocks=vi.hoisted(()=>{
  const client={query:vi.fn(),release:vi.fn()};
  return {client,connect:vi.fn(),countRecentChallenges:vi.fn(),insertChallenge:vi.fn(),lockChallenge:vi.fn(),incrementAttempts:vi.fn(),consumeChallenge:vi.fn(),upsertUser:vi.fn(),issueTokenPair:vi.fn()};
});
vi.mock('../src/db/pool.js',()=>({pool:{connect:mocks.connect}}));
vi.mock('../src/modules/accounts/repositories.js',()=>({accountRepository:{
  countRecentChallenges:mocks.countRecentChallenges,insertChallenge:mocks.insertChallenge,lockChallenge:mocks.lockChallenge,
  incrementAttempts:mocks.incrementAttempts,consumeChallenge:mocks.consumeChallenge,upsertUser:mocks.upsertUser,
}}));
vi.mock('../src/modules/accounts/tokens.js',()=>({issueTokenPair:mocks.issueTokenPair,parseToken:vi.fn(),tokenHash:vi.fn()}));

const {requestOtp,verifyOtp}=await import('../src/modules/accounts/services.js');
type InsertedChallenge={id:string;phone:string;hash:string};
const provider={sendOtp:vi.fn()};

describe('OTP services',()=>{
  beforeEach(()=>{
    vi.clearAllMocks();
    mocks.connect.mockResolvedValue(mocks.client);
    mocks.client.query.mockResolvedValue({rows:[]});
    mocks.countRecentChallenges.mockResolvedValue(0);
    mocks.issueTokenPair.mockResolvedValue({access:'access-token',refresh:'refresh-token'});
  });

  it('issues tokens for the correct code',async()=>{
    let sentCode='';
    provider.sendOtp.mockImplementation((_phone:string,code:string)=>{sentCode=code;return Promise.resolve();});
    const requested=await requestOtp({phone:'+231770555111'},provider);
    const inserted=mocks.insertChallenge.mock.calls[0]?.[1] as InsertedChallenge;
    mocks.lockChallenge.mockResolvedValue({id:requested.challenge_id,phone_e164:inserted.phone,code_hash:inserted.hash,attempts:0,consumed_at:null,expires_at:new Date(Date.now()+60_000)});
    mocks.upsertUser.mockResolvedValue({id:'019a8a4e-7b4a-7000-8000-000000000001',inserted:true});
    await expect(verifyOtp({challengeId:requested.challenge_id,code:sentCode})).resolves.toMatchObject({access:'access-token',is_new_user:true});
    expect(mocks.consumeChallenge).toHaveBeenCalledOnce();
  });

  it('rejects a wrong code and records the attempt',async()=>{
    await requestOtp({phone:'+231770555112'},provider);
    const inserted=mocks.insertChallenge.mock.calls[0]?.[1] as InsertedChallenge;
    mocks.lockChallenge.mockResolvedValue({id:inserted.id,phone_e164:inserted.phone,code_hash:inserted.hash,attempts:0,consumed_at:null,expires_at:new Date(Date.now()+60_000)});
    await expect(verifyOtp({challengeId:inserted.id,code:'999999'})).rejects.toMatchObject({code:'OTP_INVALID'} satisfies Partial<AppError>);
    expect(mocks.incrementAttempts).toHaveBeenCalledWith(mocks.client,inserted.id);
  });

  it('rejects an expired challenge',async()=>{
    mocks.lockChallenge.mockResolvedValue({id:'expired',phone_e164:'+231770555113',code_hash:'unused',attempts:0,consumed_at:null,expires_at:new Date(Date.now()-1)});
    await expect(verifyOtp({challengeId:'expired',code:'123456'})).rejects.toMatchObject({code:'OTP_INVALID'} satisfies Partial<AppError>);
  });

  it('limits repeated sends',async()=>{
    mocks.countRecentChallenges.mockResolvedValue(3);
    await expect(requestOtp({phone:'+231770555114'},provider)).rejects.toMatchObject({code:'OTP_RATE_LIMITED'} satisfies Partial<AppError>);
    expect(provider.sendOtp).not.toHaveBeenCalled();
  });
});
