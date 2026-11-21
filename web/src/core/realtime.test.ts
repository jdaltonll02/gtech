import {describe,expect,it,vi} from 'vitest';
import type {RealtimeEvent} from './realtime';
import {applyRealtimeEvent} from '../features/shell/presentation/realtimeCache';

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
});
