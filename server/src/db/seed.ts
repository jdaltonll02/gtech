import sharp from 'sharp';
import {v7 as uuid7} from 'uuid';
import {geoCell} from '../core/geo.js';
import {processImageBuffer} from '../modules/media/processing.js';
import {uploadObject} from '../modules/media/storage.js';
import {pool} from './pool.js';

const countArgument=process.argv.findIndex((value)=>value==='--users');
const count=countArgument>=0?Number(process.argv[countArgument+1]):300;
if(!Number.isInteger(count)||count<1||count>1000)throw new Error('--users must be an integer from 1 to 1000');
const places=[
  {county:'Montserrado',lat:6.3156,lng:-10.8074},{county:'Margibi',lat:6.525,lng:-10.35},{county:'Bong',lat:6.995,lng:-9.472},
  {county:'Nimba',lat:7.238,lng:-8.816},{county:'Grand Bassa',lat:5.881,lng:-10.044},{county:'Lofa',lat:8.421,lng:-9.747},
  {county:'Maryland',lat:4.375,lng:-7.717},{county:'Grand Gedeh',lat:6.066,lng:-8.128},{county:'Grand Cape Mount',lat:6.753,lng:-11.369},
] as const;
const abstractAvatar=async(index:number,variant:number)=>{
  const red=variant?'#b30b25':'#e0102d';const offset=(index*37+variant*83)%700;
  const svg=`<svg width="1200" height="1600" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="1600" fill="#111111"/><circle cx="${250+offset}" cy="500" r="420" fill="${red}"/><rect x="${(offset+300)%900}" y="850" width="650" height="650" rx="160" fill="#f5f5f5"/><circle cx="600" cy="800" r="180" fill="#777777"/></svg>`;
  return sharp(Buffer.from(svg)).webp({quality:86}).toBuffer();
};

const client=await pool.connect();
try{
  const userIds:string[]=[];let demoId='';
  for(let index=0;index<count;index+=1){
    const proposedId=uuid7();const phone=index===0?'+231770000001':`+23177${String(index+1).padStart(7,'0')}`;const place=places[index%places.length]!;
    const user=(await client.query<{id:string}>('INSERT INTO users(id,phone_e164,last_active_at) VALUES($1,$2,now()-($3*interval \'1 hour\')) ON CONFLICT(phone_e164) DO UPDATE SET last_active_at=EXCLUDED.last_active_at RETURNING id',[proposedId,phone,index%120])).rows[0]!;
    userIds.push(user.id);if(index===0)demoId=user.id;
    await client.query("INSERT INTO profiles(user_id,display_name,birth_date,gender,county,bio,languages,relationship_goal,completeness) VALUES($1,$2,CURRENT_DATE-($3||' years')::interval,$4,$5,$6,$7,'long_term',90) ON CONFLICT(user_id) DO UPDATE SET display_name=EXCLUDED.display_name,county=EXCLUDED.county",[user.id,index===0?'Pepper Demo':`Demo ${index+1}`,21+(index%18),index%2?'woman':'man',place.county,'Generated demo profile',['English',index%3===0?'Kpelle':'Liberian English']]);
    await client.query('INSERT INTO discovery_preferences(user_id) VALUES($1) ON CONFLICT(user_id) DO NOTHING',[user.id]);
    const lat=place.lat+((index%7)-3)*0.008;const lng=place.lng+((index%5)-2)*0.008;
    await client.query("INSERT INTO locations(user_id,point,geo_cell,accuracy_m,source) VALUES($1,ST_SetSRID(ST_MakePoint($2,$3),4326)::geography,$4,25,'gps') ON CONFLICT(user_id) DO UPDATE SET point=EXCLUDED.point,geo_cell=EXCLUDED.geo_cell,updated_at=now()",[user.id,lng,lat,geoCell(lat,lng).toString()]);
    const photoCount=Number((await client.query<{count:string}>('SELECT count(*) FROM photos WHERE user_id=$1',[user.id])).rows[0]?.count??0);
    for(let position=photoCount;position<2;position+=1){
      const photoId=uuid7();const original=await abstractAvatar(index,position);const processed=await processImageBuffer(original);const originalKey=`seed/${user.id}/${photoId}/original.webp`;await uploadObject(originalKey,original);const variants:Record<string,string>={};
      for(const[name,buffer]of Object.entries(processed.variants)){const key=`seed/${user.id}/${photoId}/${name}.webp`;await uploadObject(key,buffer);variants[name]=key;}
      await client.query("INSERT INTO photos(id,user_id,position,original_key,variants,blurhash,width,height,moderation_status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'approved')",[photoId,user.id,position,originalKey,variants,processed.blurhash,processed.width,processed.height]);
    }
    await client.query('INSERT INTO profile_interests(user_id,interest_id) SELECT $1::uuid,id FROM interests ORDER BY md5($1::uuid::text||id::text) LIMIT 3 ON CONFLICT DO NOTHING',[user.id]);
  }
  for(const likerId of userIds.slice(1,26))await client.query("INSERT INTO swipes(id,swiper_id,swipee_id,action) VALUES($1,$2,$3,'like') ON CONFLICT(swiper_id,swipee_id) DO NOTHING",[uuid7(),likerId,demoId]);
  console.info(`Seeded ${count} generated demo accounts with abstract media; demo phone +231770000001 accepts development OTP 000000.`);
}finally{client.release();await pool.end();}
