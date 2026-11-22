import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {RealtimeService,type RealtimeEvent} from './realtime';
import {tokenStore} from './storage';
import {applyRealtimeEvent} from '../features/shell/presentation/realtimeCache';

class FakeWebSocket{
  static readonly OPEN=1;
  static instances:FakeWebSocket[]=[];
  readyState=0;
  sent:string[]=[];
  onmessage:((event:MessageEvent)=>void)|null=null;
  onclose:(()=>void)|null=null;
  onerror:(()=>void)|null=null;
  constructor(readonly url:string|URL){FakeWebSocket.instances.push(this)}
  send(value:string){this.sent.push(value)}
  close(){this.readyState=3}
}

describe('realtime transport',()=>{
  beforeEach(()=>{
    sessionStorage.clear();
    FakeWebSocket.instances=[];
    vi.stubGlobal('WebSocket',FakeWebSocket);
    vi.stubGlobal('fetch',vi.fn(()=>Promise.resolve(new Response(JSON.stringify({messages:[]}),{status:200,headers:{'Content-Type':'application/json'}}))));
  });
  afterEach(()=>{vi.useRealTimers();vi.unstubAllGlobals()});

  it('authenticates, completes the Engine.IO handshake, synchronizes, and publishes events',async()=>{
    tokenStore.write('access-token','refresh-token');
    const service=new RealtimeService();
    const received:RealtimeEvent[]=[];
    const unsubscribe=service.subscribe(event=>received.push(event));
    service.connect();
    const socket=FakeWebSocket.instances[0]!;
    expect(String(socket.url)).toContain('token=access-token');
    socket.onmessage?.({data:'0{"sid":"socket-1"}'} as MessageEvent);
    expect(socket.sent).toContain('40');
    socket.onmessage?.({data:'40'} as MessageEvent);
    await vi.waitFor(()=>expect(received.some(event=>event.type==='sync.completed')).toBe(true));
    socket.onmessage?.({data:'42["event",{"type":"message.new","id":"event-1","ts":"2026-11-22T00:00:00.000Z","data":{"match_id":"match-1"}}]'} as MessageEvent);
    expect(received.at(-1)?.type).toBe('message.new');
    socket.readyState=FakeWebSocket.OPEN;
    service.send('typing',{match_id:'match-1',is_typing:true});
    expect(socket.sent.at(-1)).toContain('"typing"');
    unsubscribe();
    service.close();
  });

  it('does not connect without an access token',()=>{
    const service=new RealtimeService();
    service.connect();
    expect(FakeWebSocket.instances).toHaveLength(0);
    service.close();
  });

  it('reconnects with backoff after an unexpected close',()=>{
    vi.useFakeTimers();
    vi.spyOn(Math,'random').mockReturnValue(0);
    tokenStore.write('access-token','refresh-token');
    const service=new RealtimeService();
    service.connect();
    FakeWebSocket.instances[0]!.onclose?.();
    vi.advanceTimersByTime(1000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    service.close();
  });
});

describe('realtime cache reconciliation',()=>{
  it('refreshes the affected thread and match list for a message',()=>{
    const invalidateQueries=vi.fn<(options:{queryKey:readonly unknown[]})=>Promise<unknown>>(()=>Promise.resolve());
    const event:RealtimeEvent={type:'message.new',id:'event-1',ts:new Date().toISOString(),data:{match_id:'match-1'}};
    applyRealtimeEvent({invalidateQueries},event);
    expect(invalidateQueries).toHaveBeenCalledWith({queryKey:['messages','match-1']});
    expect(invalidateQueries).toHaveBeenCalledWith({queryKey:['matches']});
  });

  it('refreshes all core surfaces after reconnect synchronization',()=>{
    const invalidateQueries=vi.fn<(options:{queryKey:readonly unknown[]})=>Promise<unknown>>(()=>Promise.resolve());
    applyRealtimeEvent({invalidateQueries},{type:'sync.completed',id:'event-2',ts:new Date().toISOString(),data:{}});
    const queryKeys=invalidateQueries.mock.calls.map(([options])=>options.queryKey);
    expect(queryKeys).toEqual([['matches'],['deck'],['likes']]);
  });

  it.each([
    ['match.created',[['matches'],['deck']]],
    ['like.received',[['likes']]],
    ['entitlements.updated',[['likes'],['products']]],
  ] as const)('refreshes expected queries for %s',(type,expected)=>{
    const invalidateQueries=vi.fn<(options:{queryKey:readonly unknown[]})=>Promise<unknown>>(()=>Promise.resolve());
    applyRealtimeEvent({invalidateQueries},{type,id:'event',ts:new Date().toISOString(),data:{}});
    expect(invalidateQueries.mock.calls.map(([options])=>options.queryKey)).toEqual(expected);
  });
});
