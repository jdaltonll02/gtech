import {pool} from '../../db/pool.js';
import {likesRepository} from './repositories.js';
import {getEntitlements} from '../billing/services.js';
import {createDownloadUrl} from '../media/storage.js';
export const receivedLikes=async(userId:string)=>{
  const client=await pool.connect();
  try{
    const rows=await likesRepository.received(client,userId);
    const entitlements=await getEntitlements(userId);
    if(!entitlements.likesYou)return{count:rows.length,blurred:rows.map((row)=>({blurhash:row.blurhash}))};
    return{count:rows.length,results:await Promise.all(rows.map(async(row)=>({id:row.id,name:row.display_name,age:new Date().getUTCFullYear()-new Date(row.birth_date).getUTCFullYear(),verified:row.is_verified,photo_url:row.md_key?await createDownloadUrl(row.md_key):null,superlike:row.action==='superlike',liked_at:row.created_at})))};
  }finally{client.release();}
};
