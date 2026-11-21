import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Bolt,Heart,Info,RotateCcw,Star,X} from 'lucide-react';
import {useState} from 'react';
import {Link} from 'react-router';
import {ApiError} from '../../../core/api';
import {appRepository,type DiscoveryCard} from '../data/appRepository';
import './app-features.css';

export function DiscoverPage(){
  const client=useQueryClient();
  const deck=useQuery({queryKey:['deck'],queryFn:appRepository.deck});
  const [photo,setPhoto]=useState(0);
  const [match,setMatch]=useState<DiscoveryCard|null>(null);
  const swipe=useMutation({mutationFn:({card,action}:{card:DiscoveryCard;action:'like'|'nope'|'superlike'})=>appRepository.swipe(card.id,action),onSuccess:(result,{card})=>{client.setQueryData<DiscoveryCard[]>(['deck'],old=>old?.filter(item=>item.id!==card.id)??[]);setPhoto(0);if(result.matched)setMatch(card)},onError:(error)=>window.alert(error instanceof ApiError?error.message:'Could not record that choice.')});
  const card=deck.data?.[0];
  const choose=(action:'like'|'nope'|'superlike')=>{if(card&&!swipe.isPending)swipe.mutate({card,action})};
  if(deck.isLoading)return <Loading/>;
  if(deck.isError)return <ErrorState retry={()=>deck.refetch()}/>;
  if(!card)return <FeatureState icon={<Heart/>} title="No one new around you" body="Try widening your discovery distance or check back later." action={<Link className="primary-button" to="/app/settings">Adjust discovery</Link>}/>;
  const image=card.photos[Math.min(photo,card.photos.length-1)];
  return <section className="discover-page">
    <article className={`profile-card ${card.superliked_you?'super-card':''}`}>
      {image?<img src={image.md} srcSet={`${image.md} 640w, ${image.lg} 1200w`} sizes="(max-width: 900px) 100vw, 440px" alt={`${card.name} profile ${photo+1}`} decoding="async" fetchPriority="high"/>:<div className="photo-fallback">{card.name[0]}</div>}
      <div className="photo-bars">{card.photos.map((_,index)=><span key={index} className={index===photo?'active':''}/>)}</div>
      <button type="button" className="photo-zone previous" aria-label="Previous photo" onClick={()=>setPhoto(value=>Math.max(0,value-1))}/><button type="button" className="photo-zone next" aria-label="Next photo" onClick={()=>setPhoto(value=>Math.min(card.photos.length-1,value+1))}/>
      <div className="card-shade"/><div className="profile-copy"><h1>{card.name}, {card.age} {card.verified&&<span title="Verified">●</span>}</h1><p>{[card.job_title,card.school].filter(Boolean).join(' · ')}</p><p>{card.distance_label}{card.county&&` · ${card.county}`}</p>{card.bio&&<p className="bio">{card.bio}</p>}{card.superliked_you&&<strong className="super-label"><Star/> Super Liked you</strong>}<button className="info-button" aria-label="Profile details"><Info/></button></div>
    </article>
    <div className="action-row"><Action label="Rewind" icon={<RotateCcw/>} onClick={()=>appRepository.rewind().then(()=>deck.refetch()).catch(error=>window.alert(error instanceof Error?error.message:'Rewind unavailable'))}/><Action label="Pass" icon={<X/>} onClick={()=>choose('nope')}/><Action label="Super Like" icon={<Star/>} onClick={()=>choose('superlike')}/><Action label="Like" icon={<Heart/>} primary onClick={()=>choose('like')}/><Action label="Boost" icon={<Bolt/>} onClick={()=>appRepository.boost().then(()=>window.alert('Your boost is active.')).catch(error=>window.alert(error instanceof Error?error.message:'A boost is required.'))}/></div>
    {match&&<div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="match-title"><div className="match-modal"><Heart aria-hidden="true"/><p className="eyebrow">A NEW CONNECTION</p><h2 id="match-title">You found a spark</h2><p>You and {match.name} like each other.</p><div><button type="button" className="secondary-button" onClick={()=>setMatch(null)}>Keep discovering</button><Link className="primary-button" to="/app/chats" onClick={()=>setMatch(null)}>Say hello</Link></div></div></div>}
  </section>
}

function Action({label,icon,onClick,primary=false}:{label:string;icon:React.ReactNode;onClick:()=>void;primary?:boolean}){return <button type="button" className={`round-action ${primary?'primary':''}`} aria-label={label} title={label} onClick={onClick}>{icon}</button>}
export function Loading(){return <div className="feature-loading" role="status" aria-live="polite"><span aria-hidden="true"/><span className="visually-hidden">Loading</span></div>}
export function ErrorState({retry}:{retry:()=>void}){return <div role="alert"><FeatureState icon={<X/>} title="Could not load this" body="Check your connection and try again." action={<button type="button" className="primary-button" onClick={retry}>Try again</button>}/></div>}
export function FeatureState({icon,title,body,action}:{icon:React.ReactNode;title:string;body:string;action?:React.ReactNode}){return <section className="feature-state"><div>{icon}</div><h1>{title}</h1><p>{body}</p>{action}</section>}
