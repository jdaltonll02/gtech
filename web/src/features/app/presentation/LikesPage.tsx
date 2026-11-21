import {useQuery} from '@tanstack/react-query';
import {Heart,Star} from 'lucide-react';
import {Link} from 'react-router';
import {appRepository} from '../data/appRepository';
import {ErrorState,FeatureState,Loading} from './DiscoverPage';
import './app-features.css';

export function LikesPage(){const likes=useQuery({queryKey:['likes'],queryFn:appRepository.likes});if(likes.isLoading)return <Loading/>;if(likes.isError)return <ErrorState retry={()=>likes.refetch()}/>;const data=likes.data!;if(!data.count)return <FeatureState icon={<Heart/>} title="No likes yet" body="When someone likes you, they will appear here."/>;if(!data.results)return <section className="feature-state locked-likes"><div className="count-heart"><Heart/><strong>{data.count}</strong></div><h1>{data.count} {data.count===1?'person likes':'people like'} you</h1><p>Upgrade to see everyone who already noticed you.</p><Link className="primary-button" to="/app/upgrade">See upgrade options</Link></section>;return <section className="feature-panel"><header><p className="eyebrow">YOUR ADMIRERS</p><h1>Likes You</h1><p>People who have already noticed you.</p></header><div className="likes-grid">{data.results.map(like=><article key={like.id}>{like.photo_url?<img src={like.photo_url} alt={like.name}/>:<div className="photo-fallback">{like.name[0]}</div>}<div/><h2>{like.name}, {like.age} {like.verified&&'●'}</h2>{like.superlike&&<span><Star/> Super Like</span>}</article>)}</div></section>}
