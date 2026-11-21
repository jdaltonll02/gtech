import type {PoolClient} from 'pg';

export type PhotoRow = {id:string;user_id:string;position:number;original_key:string;variants:Record<string,string>;blurhash:string;width:number|null;height:number|null;moderation_status:'pending'|'approved'|'rejected'};

export const mediaRepository = {
  countPhotos: async (client: PoolClient, userId: string) => Number((await client.query<{count:string}>('SELECT count(*) FROM photos WHERE user_id=$1', [userId])).rows[0]?.count ?? 0),
  insertPhoto: async (client: PoolClient, values: {id:string;userId:string;position:number;key:string}) => (await client.query<PhotoRow>('INSERT INTO photos(id,user_id,position,original_key) VALUES($1,$2,$3,$4) RETURNING *', [values.id,values.userId,values.position,values.key])).rows[0]!,
  findPhoto: async (client: PoolClient, photoId: string) => (await client.query<PhotoRow>('SELECT * FROM photos WHERE id=$1', [photoId])).rows[0],
  photosForUser: async (client: PoolClient, userId: string) => (await client.query<PhotoRow>('SELECT * FROM photos WHERE user_id=$1 ORDER BY position', [userId])).rows,
  completeProcessing: async (client: PoolClient, photoId: string, values: {variants:Record<string,string>;blurhash:string;width:number;height:number;status:string}) => client.query('UPDATE photos SET variants=$2, blurhash=$3, width=$4, height=$5, moderation_status=$6, updated_at=now() WHERE id=$1', [photoId,values.variants,values.blurhash,values.width,values.height,values.status]),
  reorder: async (client: PoolClient, userId: string, photoIds: string[]) => {
    await client.query('SET CONSTRAINTS photos_user_id_position_key DEFERRED');
    for (const [position, id] of photoIds.entries()) await client.query('UPDATE photos SET position=$3, updated_at=now() WHERE id=$1 AND user_id=$2', [id,userId,position]);
  },
  deletePhoto: async (client: PoolClient, photoId: string, userId: string) => (await client.query<PhotoRow>('DELETE FROM photos WHERE id=$1 AND user_id=$2 RETURNING *', [photoId,userId])).rows[0],
};
