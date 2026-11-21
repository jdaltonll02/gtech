import {BriefcaseBusiness,Heart,Music2,Palmtree} from 'lucide-react';
import {useNavigate} from 'react-router';
import './app-features.css';

const themes=[['Ready for something real','People looking for a long-term connection',Heart],['Liberian culture','Food, music and traditions in common',Music2],['Adventure nearby','Beach days, road trips and new places',Palmtree],['Building big things','Meet entrepreneurs and ambitious people',BriefcaseBusiness]] as const;
export function ExplorePage(){const navigate=useNavigate();return <section className="feature-panel explore-page"><header><p className="eyebrow">FIND YOUR PEOPLE</p><h1>Explore</h1><p>Start with something you already have in common.</p></header><div className="explore-grid">{themes.map(([title,body,Icon],index)=><button key={title} className={index%2?'dark':''} onClick={()=>navigate('/app/discover')}><Icon/><span><strong>{title}</strong><small>{body}</small></span></button>)}</div></section>}
