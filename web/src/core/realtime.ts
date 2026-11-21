import {config} from './config';
import {tokenStore} from './storage';

export type RealtimeEvent={type:string;id:string;ts:string;data:unknown};

export class RealtimeService{
  private socket?:WebSocket;
  private reconnect?:number;
  private heartbeat?:number;
  private attempt=0;
  private since=new Date().toISOString();
  private closed=false;
  private listeners=new Set<(event:RealtimeEvent)=>void>();

  subscribe(listener:(event:RealtimeEvent)=>void){this.listeners.add(listener);return()=>this.listeners.delete(listener)}

  connect(){
    if(this.closed||typeof WebSocket==='undefined'||this.socket?.readyState===WebSocket.OPEN)return;
    const token=tokenStore.access();if(!token)return;
    const url=new URL(config.apiBaseUrl);url.protocol=url.protocol==='https:'?'wss:':'ws:';url.pathname='/ws/';url.search=new URLSearchParams({EIO:'4',transport:'websocket',token}).toString();
    this.socket=new WebSocket(url);
    this.socket.onmessage=message=>this.receive(String(message.data));
    this.socket.onclose=()=>this.schedule();
    this.socket.onerror=()=>this.socket?.close();
  }

  private receive(raw:string){
    if(raw.startsWith('0')){this.socket?.send('40');return}
    if(raw==='2'){this.socket?.send('3');return}
    if(raw.startsWith('40')){this.attempt=0;if(this.heartbeat)clearInterval(this.heartbeat);this.heartbeat=window.setInterval(()=>this.sendSocketEvent('ping',{}),25_000);void this.resync();return}
    if(!raw.startsWith('42'))return;
    try{const [,value]=JSON.parse(raw.slice(2)) as [string,RealtimeEvent];if(!value?.type)return;this.since=value.ts;this.publish(value)}catch{return}
  }

  send(type:string,data:unknown){if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(`42["event",${JSON.stringify({type,data})}]`)}
  private sendSocketEvent(type:string,data:unknown){if(this.socket?.readyState===WebSocket.OPEN)this.socket.send(`42[${JSON.stringify(type)},${JSON.stringify(data)}]`)}

  private publish(event:RealtimeEvent){for(const listener of this.listeners)listener(event)}

  private schedule(){
    this.socket=undefined;
    if(this.heartbeat){clearInterval(this.heartbeat);this.heartbeat=undefined}
    if(this.closed||this.reconnect)return;
    const delay=Math.min(30_000,2**this.attempt++*1000)+Math.random()*500;
    this.reconnect=window.setTimeout(()=>{this.reconnect=undefined;this.connect()},delay);
  }

  private async resync(){
    try{const data=await apiSync(this.since);this.publish({type:'sync.completed',id:crypto.randomUUID(),ts:new Date().toISOString(),data})}catch{this.socket?.close()}
  }

  close(){this.closed=true;if(this.reconnect)clearTimeout(this.reconnect);if(this.heartbeat)clearInterval(this.heartbeat);this.socket?.close();this.socket=undefined;this.listeners.clear()}
}

const apiSync=async(since:string)=>{
  const response=await fetch(`${config.apiBaseUrl}/api/v1/sync?since=${encodeURIComponent(since)}`,{headers:{Authorization:`Bearer ${tokenStore.access()??''}`}});
  if(!response.ok)throw new Error('Realtime synchronization failed.');
  return response.json() as Promise<unknown>;
};
