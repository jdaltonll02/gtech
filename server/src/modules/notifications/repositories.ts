import type {PoolClient} from 'pg';

export type NotificationPreferences={user_id:string;new_matches:boolean;messages:boolean;likes:boolean;promotions:boolean;message_previews:boolean;updated_at:Date};
export const notificationRepository={
  preferences:async(client:PoolClient,userId:string)=>(await client.query<NotificationPreferences>('SELECT * FROM notification_preferences WHERE user_id=$1',[userId])).rows[0]??null,
  upsertPreferences:async(client:PoolClient,userId:string,values:Omit<NotificationPreferences,'user_id'|'updated_at'>)=>(await client.query<NotificationPreferences>('INSERT INTO notification_preferences(user_id,new_matches,messages,likes,promotions,message_previews)VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(user_id)DO UPDATE SET new_matches=EXCLUDED.new_matches,messages=EXCLUDED.messages,likes=EXCLUDED.likes,promotions=EXCLUDED.promotions,message_previews=EXCLUDED.message_previews,updated_at=now() RETURNING *',[userId,values.new_matches,values.messages,values.likes,values.promotions,values.message_previews])).rows[0]!,
  deviceTokens:async(client:PoolClient,userId:string)=>(await client.query<{fcm_token:string}>("SELECT DISTINCT fcm_token FROM devices WHERE user_id=$1 AND fcm_token<>''",[userId])).rows.map((row)=>row.fcm_token),
  claimLog:async(client:PoolClient,values:{id:string;userId:string;kind:string;dedupKey:string;provider:string})=>(await client.query<{id:string}>('INSERT INTO notification_logs(id,user_id,kind,dedup_key,provider,status)VALUES($1,$2,$3,$4,$5,\'skipped\') ON CONFLICT(dedup_key)DO NOTHING RETURNING id',[values.id,values.userId,values.kind,values.dedupKey,values.provider])).rows[0],
  finishLog:(client:PoolClient,id:string,status:'sent'|'skipped'|'failed',error='')=>client.query('UPDATE notification_logs SET status=$2,error=$3 WHERE id=$1',[id,status,error]),
};
