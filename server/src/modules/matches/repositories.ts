import type {PoolClient} from 'pg';

export type MatchListRow={id:string;created_at:Date;other_user_id:string;display_name:string|null;blurhash:string|null;last_body:string|null;last_kind:string|null;last_message_created_at:Date|null;unread_count:number};
export type UnmatchedRow={id:string;user_a_id:string;user_b_id:string;unmatched_at:Date};
export const matchRepository={
  list:async(client:PoolClient,userId:string,before:Date|undefined,limit:number)=>(await client.query<MatchListRow>(`SELECT m.id,m.created_at,CASE WHEN m.user_a_id=$1 THEN m.user_b_id ELSE m.user_a_id END AS other_user_id,p.display_name,ph.blurhash,lm.body AS last_body,lm.kind AS last_kind,lm.created_at AS last_message_created_at,(SELECT count(*)::int FROM messages unread WHERE unread.match_id=m.id AND unread.sender_id<>$1 AND unread.read_at IS NULL AND unread.deleted_at IS NULL) AS unread_count
    FROM matches m JOIN profiles p ON p.user_id=CASE WHEN m.user_a_id=$1 THEN m.user_b_id ELSE m.user_a_id END
    LEFT JOIN LATERAL(SELECT blurhash FROM photos WHERE user_id=p.user_id AND moderation_status='approved' ORDER BY position LIMIT 1)ph ON true
    LEFT JOIN LATERAL(SELECT body,kind,created_at FROM messages WHERE match_id=m.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1)lm ON true
    WHERE (m.user_a_id=$1 OR m.user_b_id=$1) AND m.unmatched_at IS NULL AND ($2::timestamptz IS NULL OR COALESCE(m.last_message_at,m.created_at)<$2) ORDER BY COALESCE(m.last_message_at,m.created_at) DESC LIMIT $3`,[userId,before??null,limit])).rows,
  unmatch:async(client:PoolClient,matchId:string,userId:string)=>(await client.query<UnmatchedRow>('UPDATE matches SET unmatched_at=now(),unmatched_by=$2 WHERE id=$1 AND unmatched_at IS NULL AND (user_a_id=$2 OR user_b_id=$2) RETURNING id,user_a_id,user_b_id,unmatched_at',[matchId,userId])).rows[0],
};
