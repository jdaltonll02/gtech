import { readdir,writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { prisma } from '../lib/prisma.js';
import { exists,mediaRoot,remove } from '../services/storage.js';

export async function processUploadedImage(mediaId,localPath){try{const output=await sharp(localPath).rotate().resize({width:1920,height:1080,fit:'inside',withoutEnlargement:true}).webp({quality:85}).toBuffer();await writeFile(localPath,output);await prisma.$executeRawUnsafe('UPDATE media SET size_bytes=$1,content_type=$2 WHERE id=$3::uuid',output.length,'image/webp',mediaId);return{media_id:mediaId,size_bytes:output.length,status:'processed'};}catch(error){console.error('process_uploaded_image failed',{mediaId,message:error.message});return{media_id:mediaId,status:'failed',error:error.message};}}
async function files(root){const found=[];if(!await exists(root))return found;for(const item of await readdir(root,{withFileTypes:true})){const full=path.join(root,item.name);if(item.isDirectory())found.push(...await files(full));else found.push(full);}return found;}
// Disk location a media row is actually served from. `url` (/media/<folder>/<file>) is the
// stable reference; `local_path` is an absolute path that may come from the old Python host.
export function servedPath(row){
  const relative=String(row.url??'').replace(/^\/media\//,'');
  if(!relative||relative===row.url)return null;
  const full=path.resolve(mediaRoot,relative);
  return full.startsWith(path.resolve(mediaRoot)+path.sep)?full:null;
}

// Never deletes database rows: a missing file can mean an unmigrated legacy path or a
// redeploy that replaced the app directory, and the row is the only record of the upload.
// Rows without a file are reported so they can be repaired by hand.
export async function cleanupOrphanedMedia(){
  const rows=await prisma.$queryRawUnsafe('SELECT id,url,local_path FROM media');
  if(!rows.length)return{missing_files:0,removed_files:0,skipped:'no media rows; refusing to delete files'};
  const referenced=new Set();
  for(const row of rows){
    for(const candidate of [servedPath(row),row.local_path&&path.resolve(row.local_path)])if(candidate)referenced.add(candidate);
  }
  let missing_files=0,removed_files=0;
  for(const row of rows){
    const served=servedPath(row);
    if(!(served&&await exists(served))&&!(row.local_path&&await exists(row.local_path)))missing_files++;
  }
  for(const file of await files(mediaRoot))if(!referenced.has(path.resolve(file))){await remove(file);removed_files++;}
  if(missing_files)console.warn(`cleanup_orphaned_media: ${missing_files} media row(s) have no file on disk; rows kept`);
  return{missing_files,removed_files};
}
