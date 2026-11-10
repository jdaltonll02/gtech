import { readdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { prisma } from '../lib/prisma.js';
import { exists,mediaRoot,remove } from '../services/storage.js';

export async function processUploadedImage(mediaId,localPath){try{const output=await sharp(localPath).rotate().resize({width:1920,height:1080,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();await writeFile(localPath,output);await prisma.$executeRawUnsafe('UPDATE media SET size_bytes=$1,content_type=$2 WHERE id=$3::uuid',output.length,'image/webp',mediaId);return{media_id:mediaId,size_bytes:output.length,status:'processed'};}catch(error){console.error('process_uploaded_image failed',{mediaId,message:error.message});return{media_id:mediaId,status:'failed',error:error.message};}}
async function files(root){const found=[];if(!await exists(root))return found;for(const item of await readdir(root,{withFileTypes:true})){const full=path.join(root,item.name);if(item.isDirectory())found.push(...await files(full));else found.push(full);}return found;}
export async function cleanupOrphanedMedia(){let removed_records=0,removed_files=0;const rows=await prisma.$queryRawUnsafe('SELECT id,local_path FROM media');for(const row of rows)if(!await exists(row.local_path)){removed_records+=await prisma.$executeRawUnsafe('DELETE FROM media WHERE id=$1::uuid',String(row.id));}const valid=new Set((await prisma.$queryRawUnsafe('SELECT local_path FROM media')).map((x)=>path.resolve(x.local_path)));for(const file of await files(mediaRoot))if(!valid.has(path.resolve(file))){await remove(file);removed_files++;}return{removed_records,removed_files};}
