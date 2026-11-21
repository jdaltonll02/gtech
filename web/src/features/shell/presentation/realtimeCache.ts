import type {RealtimeEvent} from '../../../core/realtime';

export type QueryInvalidator={invalidateQueries:(options:{queryKey:readonly unknown[]})=>Promise<unknown>};

export function applyRealtimeEvent(client:QueryInvalidator,event:RealtimeEvent){
  const data=event.data&&typeof event.data==='object'?event.data as Record<string,unknown>:{};
  const matchId=typeof data.match_id==='string'?data.match_id:undefined;
  if(event.type==='message.new'||event.type==='message.read'||event.type==='typing'){
    if(matchId)void client.invalidateQueries({queryKey:['messages',matchId]});
    void client.invalidateQueries({queryKey:['matches']});
  }else if(event.type==='match.created'||event.type==='match.removed'){
    void client.invalidateQueries({queryKey:['matches']});
    void client.invalidateQueries({queryKey:['deck']});
  }else if(event.type==='like.received'){
    void client.invalidateQueries({queryKey:['likes']});
  }else if(event.type==='entitlements.updated'){
    void client.invalidateQueries({queryKey:['likes']});
    void client.invalidateQueries({queryKey:['products']});
  }else if(event.type==='sync.completed'){
    for(const queryKey of[['matches'],['deck'],['likes']] as const)void client.invalidateQueries({queryKey});
  }
}
