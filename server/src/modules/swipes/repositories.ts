import type {PoolClient} from 'pg';

export type SwipeRow={id:string;swiper_id:string;swipee_id:string;action:'like'|'nope'|'superlike';created_at:Date};
export type MatchRow={id:string;user_a_id:string;user_b_id:string;created_at:Date;unmatched_at:Date|null};

export const swipeRepository={
  lockPair:(client:PoolClient,userA:string,userB:string)=>client.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))',[`${userA < userB ? userA : userB}:${userA < userB ? userB : userA}`]),
  findSwipe:async(client:PoolClient,swiperId:string,swipeeId:string)=>(await client.query<SwipeRow>('SELECT * FROM swipes WHERE swiper_id=$1 AND swipee_id=$2 AND rewound=false',[swiperId,swipeeId])).rows[0],
  findActiveMatch:async(client:PoolClient,userA:string,userB:string)=>(await client.query<MatchRow>('SELECT * FROM matches WHERE unmatched_at IS NULL AND ((user_a_id=$1 AND user_b_id=$2)OR(user_a_id=$2 AND user_b_id=$1))',[userA,userB])).rows[0],
  targetAvailable:async(client:PoolClient,userId:string,targetId:string)=>(await client.query<{exists:boolean}>("SELECT EXISTS(SELECT 1 FROM users u JOIN discovery_preferences d ON d.user_id=u.id WHERE u.id=$2 AND u.status='active' AND d.is_discoverable AND NOT EXISTS(SELECT 1 FROM blocks b WHERE(b.blocker_id=$1 AND b.blocked_id=$2)OR(b.blocker_id=$2 AND b.blocked_id=$1))) AS exists",[userId,targetId])).rows[0]?.exists??false,
  insertSwipe:async(client:PoolClient,values:{id:string;swiperId:string;swipeeId:string;action:string;clientTs?:string|undefined})=>(await client.query<SwipeRow>('INSERT INTO swipes(id,swiper_id,swipee_id,action,client_ts) VALUES($1,$2,$3,$4,$5) ON CONFLICT(swiper_id,swipee_id) DO NOTHING RETURNING *',[values.id,values.swiperId,values.swipeeId,values.action,values.clientTs??null])).rows[0],
  hasReciprocalLike:async(client:PoolClient,swiperId:string,swipeeId:string)=>(await client.query<{exists:boolean}>("SELECT EXISTS(SELECT 1 FROM swipes WHERE swiper_id=$1 AND swipee_id=$2 AND action IN ('like','superlike') AND rewound=false) AS exists",[swipeeId,swiperId])).rows[0]?.exists??false,
  createMatch:async(client:PoolClient,values:{id:string;userA:string;userB:string;initiatedBySuperlike:boolean})=>(await client.query<MatchRow>('INSERT INTO matches(id,user_a_id,user_b_id,initiated_by_superlike) VALUES($1,$2,$3,$4) ON CONFLICT(user_a_id,user_b_id) DO UPDATE SET unmatched_at=NULL,unmatched_by=NULL,initiated_by_superlike=EXCLUDED.initiated_by_superlike RETURNING *',[values.id,values.userA,values.userB,values.initiatedBySuperlike])).rows[0]!,
  lockLatestSwipe:async(client:PoolClient,userId:string)=>(await client.query<SwipeRow>('SELECT * FROM swipes WHERE swiper_id=$1 AND rewound=false ORDER BY created_at DESC LIMIT 1 FOR UPDATE',[userId])).rows[0],
  rewind:(client:PoolClient,swipeId:string)=>client.query('UPDATE swipes SET rewound=true WHERE id=$1',[swipeId]),
};
