import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Compass,Grid2X2,Heart,MessageCircle,Settings,UserRound} from 'lucide-react';
import {useEffect} from 'react';
import {NavLink,Outlet,useNavigate} from 'react-router';
import {RealtimeService} from '../../../core/realtime';
import {appRepository} from '../../app/data/appRepository';
import {Avatar} from '../../app/presentation/ChatsPage';
import {applyRealtimeEvent} from './realtimeCache';
import './shell.css';
import './accessibility.css';

const tabs=[['Discover','/app/discover',Compass],['Explore','/app/explore',Grid2X2],['Likes','/app/likes',Heart],['Chats','/app/chats',MessageCircle],['Profile','/app/profile',UserRound]] as const;

export function AppShell(){
  const navigate=useNavigate();
  const queryClient=useQueryClient();
  const matches=useQuery({queryKey:['matches'],queryFn:appRepository.matches,retry:false});

  useEffect(()=>{
    const realtime=new RealtimeService();
    const unsubscribe=realtime.subscribe(event=>applyRealtimeEvent(queryClient,event));
    realtime.connect();
    return()=>{unsubscribe();realtime.close()};
  },[queryClient]);

  return <div className="app-shell"><a className="skip-link" href="#main-content">Skip to main content</a><aside className="connections" aria-label="Connections and navigation"><header><span className="shell-brand">pepper<span>●</span></span><button type="button" aria-label="Settings" onClick={()=>navigate('/app/settings')}><Settings aria-hidden="true"/></button></header><nav aria-label="Primary navigation">{tabs.map(([label,path,Icon])=><NavLink key={path} to={path}><Icon aria-hidden="true"/><span>{label}</span></NavLink>)}</nav><section><h2>Connections</h2>{matches.data?.length?<div className="sidebar-matches">{matches.data.slice(0,8).map(match=><NavLink to={`/app/chats/${match.id}`} key={match.id}><Avatar name={match.other_user.display_name}/><span><strong>{match.other_user.display_name}</strong><small>{match.last_message?.body||'New connection'}</small></span>{match.unread_count>0&&<b aria-label={`${match.unread_count} unread messages`}>{match.unread_count}</b>}</NavLink>)}</div>:<p>Your new matches and conversations will appear here.</p>}</section></aside><main className="stage" id="main-content" tabIndex={-1}><Outlet/></main><nav className="mobile-tabs" aria-label="Primary navigation">{tabs.map(([label,path,Icon])=><NavLink key={path} to={path} aria-label={label}><Icon aria-hidden="true"/><span>{label}</span></NavLink>)}</nav></div>;
}
