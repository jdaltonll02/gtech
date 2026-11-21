import type {PoolClient} from 'pg';

export const lifecycleRepository={
  setStatus:async(client:PoolClient,userId:string,status:'active'|'paused'|'deleted')=>(await client.query<{id:string;status:string}>('UPDATE users SET status=$2,updated_at=now() WHERE id=$1 AND status NOT IN(\'banned\',\'deleted\') RETURNING id,status',[userId,status])).rows[0]??null,
  setDiscoverable:(client:PoolClient,userId:string,value:boolean)=>client.query('UPDATE discovery_preferences SET is_discoverable=$2 WHERE user_id=$1',[userId,value]),
  cancelDeletion:(client:PoolClient,userId:string)=>client.query('UPDATE account_deletion_requests SET cancelled_at=now() WHERE user_id=$1 AND cancelled_at IS NULL',[userId]),
  requestDeletion:(client:PoolClient,userId:string)=>client.query('INSERT INTO account_deletion_requests(user_id)VALUES($1)ON CONFLICT(user_id)DO UPDATE SET requested_at=now(),hard_delete_at=now()+interval \'30 days\',cancelled_at=NULL',[userId]),
  revokeTokens:(client:PoolClient,userId:string)=>client.query('UPDATE refresh_tokens SET revoked_at=COALESCE(revoked_at,now()) WHERE user_id=$1',[userId]),
  removeMatches:async(client:PoolClient,userId:string)=>(await client.query<{id:string;user_a_id:string;user_b_id:string;unmatched_at:Date}>('UPDATE matches SET unmatched_at=now(),unmatched_by=$1 WHERE unmatched_at IS NULL AND(user_a_id=$1 OR user_b_id=$1)RETURNING id,user_a_id,user_b_id,unmatched_at',[userId])).rows,
  exportData:async(client:PoolClient,userId:string)=>{const queries=await Promise.all([
    client.query<Record<string,unknown>>('SELECT id,phone_e164,email,status,created_at,updated_at FROM users WHERE id=$1',[userId]),
    client.query<Record<string,unknown>>('SELECT user_id,display_name,birth_date,gender,show_gender_on_profile,bio,job_title,company,school,county,hometown,languages,height_cm,relationship_goal,show_orientation,show_religion,prompts,is_verified,created_at,updated_at FROM profiles WHERE user_id=$1',[userId]),
    client.query<Record<string,unknown>>('SELECT * FROM discovery_preferences WHERE user_id=$1',[userId]),
    client.query<Record<string,unknown>>('SELECT source,accuracy_m,updated_at,ST_Y(point::geometry) AS latitude,ST_X(point::geometry) AS longitude FROM locations WHERE user_id=$1',[userId]),
    client.query<Record<string,unknown>>('SELECT id,position,moderation_status,created_at FROM photos WHERE user_id=$1 ORDER BY position',[userId]),
    client.query<Record<string,unknown>>('SELECT id,swiper_id,swipee_id,action,created_at FROM swipes WHERE swiper_id=$1 OR swipee_id=$1 ORDER BY created_at',[userId]),
    client.query<Record<string,unknown>>('SELECT id,user_a_id,user_b_id,created_at,unmatched_at FROM matches WHERE user_a_id=$1 OR user_b_id=$1 ORDER BY created_at',[userId]),
    client.query<Record<string,unknown>>('SELECT msg.id,msg.match_id,msg.sender_id,msg.kind,msg.body,msg.safety_warning,msg.created_at,msg.read_at FROM messages msg JOIN matches m ON m.id=msg.match_id WHERE m.user_a_id=$1 OR m.user_b_id=$1 ORDER BY msg.created_at',[userId]),
    client.query<Record<string,unknown>>('SELECT p.id,pr.sku,p.provider,p.status,p.amount,p.currency,p.created_at,p.updated_at FROM purchases p JOIN products pr ON pr.id=p.product_id WHERE p.user_id=$1 ORDER BY p.created_at',[userId]),
    client.query<Record<string,unknown>>('SELECT id,blocked_id,created_at FROM blocks WHERE blocker_id=$1 ORDER BY created_at',[userId]),
    client.query<Record<string,unknown>>('SELECT id,reported_id,reason,details,status,created_at FROM reports WHERE reporter_id=$1 ORDER BY created_at',[userId]),
  ] as const);return{account:queries[0].rows[0]??null,profile:queries[1].rows[0]??null,preferences:queries[2].rows[0]??null,location:queries[3].rows[0]??null,photos:queries[4].rows,swipes:queries[5].rows,matches:queries[6].rows,messages:queries[7].rows,purchases:queries[8].rows,blocks:queries[9].rows,reports:queries[10].rows};},
  addExport:(client:PoolClient,id:string,userId:string,key:string)=>client.query('INSERT INTO account_exports(id,user_id,object_key)VALUES($1,$2,$3)',[id,userId,key]),
  dueDeletions:async(client:PoolClient)=>(await client.query<{user_id:string}>("SELECT user_id FROM account_deletion_requests WHERE cancelled_at IS NULL AND hard_delete_at<=now() FOR UPDATE SKIP LOCKED LIMIT 100")).rows,
  storageKeys:async(client:PoolClient,userId:string)=>{const result=await client.query<{key:string}>(`SELECT original_key AS key FROM photos WHERE user_id=$1 UNION ALL SELECT value FROM photos CROSS JOIN LATERAL jsonb_each_text(variants) WHERE user_id=$1 UNION ALL SELECT selfie_key FROM verifications WHERE user_id=$1 AND selfie_key IS NOT NULL UNION ALL SELECT media_key FROM messages msg JOIN matches m ON m.id=msg.match_id WHERE(m.user_a_id=$1 OR m.user_b_id=$1)AND media_key IS NOT NULL UNION ALL SELECT object_key FROM account_exports WHERE user_id=$1`,[userId]);return result.rows.map(row=>row.key);},
  hardDelete:(client:PoolClient,userId:string)=>client.query('DELETE FROM users WHERE id=$1',[userId]),
};
