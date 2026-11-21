import type {PoolClient} from 'pg';

export type DiscoveryContext={latitude:number;longitude:number;max_distance_km:number;global_mode:boolean};
export type CandidateRow={id:string;last_active_at:Date;created_at:Date;completeness:number;distance_m:number;inbound_likes:number;inbound_swipes:number;shared_count:number;liked_me:boolean;boost_active:boolean;priority_ranking:boolean};
export type CardRow={id:string;display_name:string;birth_date:string;is_verified:boolean;county:string|null;job_title:string;school:string;bio:string;prompts:unknown[];distance_m:number;interests:unknown[];photos:Array<{md_key:string;lg_key:string;blurhash:string}>;superliked_you:boolean};

const effectiveLocation=`LEFT JOIN passport_locations pass ON pass.user_id=u.id AND (pass.expires_at IS NULL OR pass.expires_at>now()) JOIN locations loc ON loc.user_id=u.id`;
export const discoveryRepository={
  context:async(client:PoolClient,userId:string)=>(await client.query<DiscoveryContext>(`SELECT ST_Y(COALESCE(pass.point,loc.point)::geometry) AS latitude,ST_X(COALESCE(pass.point,loc.point)::geometry) AS longitude,d.max_distance_km,d.global_mode FROM users u JOIN discovery_preferences d ON d.user_id=u.id ${effectiveLocation} WHERE u.id=$1`,[userId])).rows[0],
  candidates:async(client:PoolClient,userId:string,cells:string[])=>(await client.query<CandidateRow>(`WITH me AS(
      SELECT u.id,p.gender,p.birth_date,p.county,p.languages,p.relationship_goal,d.*,COALESCE(pass.point,loc.point) AS point FROM users u JOIN profiles p ON p.user_id=u.id JOIN discovery_preferences d ON d.user_id=u.id ${effectiveLocation} WHERE u.id=$1
    ) SELECT u.id,u.last_active_at,u.created_at,p.completeness,ST_Distance(COALESCE(cp.point,cl.point),me.point)::float8 AS distance_m,
      (SELECT count(*)::int FROM swipes si WHERE si.swipee_id=u.id AND si.action IN ('like','superlike') AND si.rewound=false) AS inbound_likes,
      (SELECT count(*)::int FROM swipes si WHERE si.swipee_id=u.id AND si.rewound=false) AS inbound_swipes,
      (CASE WHEN p.county IS NOT NULL AND p.county=me.county THEN 1 ELSE 0 END+CASE WHEN p.relationship_goal IS NOT NULL AND p.relationship_goal=me.relationship_goal THEN 1 ELSE 0 END+(SELECT count(*)::int FROM unnest(p.languages) lang WHERE lang=ANY(me.languages))) AS shared_count,
      EXISTS(SELECT 1 FROM swipes liked WHERE liked.swiper_id=u.id AND liked.swipee_id=$1 AND liked.action IN ('like','superlike') AND liked.rewound=false) AS liked_me,
      EXISTS(SELECT 1 FROM boosts bo WHERE bo.user_id=u.id AND bo.starts_at<=now() AND bo.expires_at>now()) AS boost_active,
      EXISTS(SELECT 1 FROM subscriptions sub WHERE sub.user_id=u.id AND sub.tier='platinum' AND sub.status='active' AND sub.expires_at>now()) AS priority_ranking
    FROM me,users u JOIN profiles p ON p.user_id=u.id JOIN discovery_preferences d ON d.user_id=u.id JOIN locations cl ON cl.user_id=u.id LEFT JOIN passport_locations cp ON cp.user_id=u.id AND(cp.expires_at IS NULL OR cp.expires_at>now())
    WHERE u.id<>$1 AND u.status='active' AND u.last_active_at>=now()-interval '30 days' AND d.is_discoverable
      AND p.gender=ANY(me.show_me) AND me.gender=ANY(d.show_me)
      AND date_part('year',age(p.birth_date)) BETWEEN me.age_min AND me.age_max AND date_part('year',age(me.birth_date)) BETWEEN d.age_min AND d.age_max
      AND (SELECT count(*) FROM photos ph WHERE ph.user_id=u.id AND ph.moderation_status IN ('pending','approved'))>=2
      AND NOT EXISTS(SELECT 1 FROM swipes s WHERE s.swiper_id=$1 AND s.swipee_id=u.id AND s.rewound=false)
      AND NOT EXISTS(SELECT 1 FROM matches m WHERE m.unmatched_at IS NULL AND ((m.user_a_id=$1 AND m.user_b_id=u.id)OR(m.user_b_id=$1 AND m.user_a_id=u.id)))
      AND NOT EXISTS(SELECT 1 FROM blocks b WHERE (b.blocker_id=$1 AND b.blocked_id=u.id)OR(b.blocker_id=u.id AND b.blocked_id=$1))
      AND (me.counties_filter='{}' OR p.county=ANY(me.counties_filter))
      AND (me.global_mode OR (COALESCE(cp.geo_cell,cl.geo_cell)=ANY($2::bigint[]) AND ST_DWithin(COALESCE(cp.point,cl.point),me.point,me.max_distance_km*1000)))
    LIMIT 500`,[userId,cells])).rows,
  cards:async(client:PoolClient,userId:string,ids:string[])=>(await client.query<CardRow>(`WITH me AS(SELECT COALESCE(pass.point,loc.point) AS point FROM users u ${effectiveLocation} WHERE u.id=$1)
    SELECT u.id,p.display_name,p.birth_date,p.is_verified,p.county,p.job_title,p.school,p.bio,p.prompts,ST_Distance(COALESCE(cp.point,cl.point),me.point)::float8 AS distance_m,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('id',i.id,'slug',i.slug,'label',i.label)ORDER BY i.sort_order)FROM profile_interests pi JOIN interests i ON i.id=pi.interest_id WHERE pi.user_id=u.id),'[]') AS interests,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('md_key',ph.variants->>'md','lg_key',ph.variants->>'lg','blurhash',ph.blurhash)ORDER BY ph.position)FROM photos ph WHERE ph.user_id=u.id AND ph.moderation_status='approved'),'[]') AS photos,
      EXISTS(SELECT 1 FROM swipes s WHERE s.swiper_id=u.id AND s.swipee_id=$1 AND s.action='superlike' AND s.rewound=false) AS superliked_you
    FROM me,users u JOIN profiles p ON p.user_id=u.id JOIN locations cl ON cl.user_id=u.id LEFT JOIN passport_locations cp ON cp.user_id=u.id AND(cp.expires_at IS NULL OR cp.expires_at>now()) WHERE u.id=ANY($2::uuid[]) ORDER BY array_position($2::uuid[],u.id)`,[userId,ids])).rows,
};
