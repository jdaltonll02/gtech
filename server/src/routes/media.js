import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { requireAdmin, requireUser } from '../auth/middleware.js';
import { asyncHandler, HttpError } from '../lib/http-error.js';
import { prisma } from '../lib/prisma.js';
import { enqueue } from '../jobs/runner.js';
import { processUploadedImage } from '../jobs/media.js';
import { exists, mediaRoot, move, projectRoot, remove, store } from '../services/storage.js';

export const mediaRouter=Router();
const upload=multer({storage:multer.memoryStorage(),limits:{fileSize:20*1024*1024}});
const allowed=new Set(['jpg','jpeg','png','gif','webp','svg','pdf','doc','docx','mp4','webm','mov','mp3','wav','zip']);
const folders=z.enum(['uploads','profile','courses','resumes','team','gallery','products','course-content','blog']);
const adminFolders=new Set(['courses','team','gallery','products','course-content','blog']);
const responseFields=['id','filename','original_filename','content_type','size_bytes','url','folder'];
const out=(x)=>Object.fromEntries(responseFields.map((k)=>[k,x[k]]));
const magic={jpg:Buffer.from([0xff,0xd8,0xff]),jpeg:Buffer.from([0xff,0xd8,0xff]),png:Buffer.from([0x89,0x50,0x4e,0x47]),gif:Buffer.from('GIF8'),pdf:Buffer.from('%PDF')};
function sanitize(ext,buffer){if(magic[ext]&&!buffer.subarray(0,magic[ext].length).equals(magic[ext]))throw new HttpError(415,'File content does not match its declared extension.');if(ext!=='svg')return buffer;return Buffer.from(buffer.toString('utf8').replace(/<script[^>]*>[\s\S]*?<\/script>/gi,'').replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi,'').replace(/\s+on\w+\s*=\s*\S+/gi,''));}
const multerOne=(q,s,next)=>upload.single('file')(q,s,(error)=>{if(error?.code==='LIMIT_FILE_SIZE')return next(new HttpError(413,'File exceeds the 20 MB limit.'));next(error);});

mediaRouter.post('/upload',requireUser,multerOne,asyncHandler(async(q,s)=>{if(!q.file)throw new HttpError(422,[{type:'missing',loc:['body','file'],msg:'Field required',input:null}]);const folder=folders.parse(String(q.query.folder??'uploads'));if(adminFolders.has(folder)&&!['admin','superadmin'].includes(q.user.role))throw new HttpError(403,'Admin access required for this folder.');const original=q.file.originalname||'file',ext=original.includes('.')?original.split('.').pop().toLowerCase():original.toLowerCase();if(!allowed.has(ext))throw new HttpError(415,`File type '.${ext}' is not allowed.`);const content=sanitize(ext,q.file.buffer),filename=`${randomUUID()}.${ext}`,localPath=await store(folder,filename,content),url=`/media/${folder}/${filename}`,id=randomUUID();try{const rows=await prisma.$queryRawUnsafe('INSERT INTO media(id,filename,original_filename,content_type,size_bytes,local_path,url,folder,uploaded_by,created_at) VALUES($1::uuid,$2,$3,$4,$5,$6,$7,$8,$9::uuid,NOW()) RETURNING *',id,filename,original,q.file.mimetype||'application/octet-stream',content.length,localPath,url,folder,String(q.user.id));if(['jpg','jpeg','png','webp'].includes(ext))enqueue('process_uploaded_image',()=>processUploadedImage(id,localPath),{retries:0});s.status(201).json(out(rows[0]));}catch(error){await remove(localPath);throw error;}}));
mediaRouter.get('/',...requireAdmin,asyncHandler(async(q,s)=>{const skip=z.coerce.number().int().default(0).parse(q.query.skip),limit=z.coerce.number().int().default(50).parse(q.query.limit);s.json((await prisma.$queryRawUnsafe('SELECT * FROM media ORDER BY created_at DESC OFFSET $1 LIMIT $2',skip,limit)).map(out));}));
mediaRouter.post('/migrate-legacy',...requireAdmin,asyncHandler(async(_q,s)=>{const legacyRoot=path.join(projectRoot,'backend','app','api','media');if(!await exists(legacyRoot))return s.json({moved_files:0,updated_rows:0,missing_sources:0,detail:'Legacy media directory not found; nothing to migrate.'});let moved=0,updated=0,missing=0;for(const row of await prisma.$queryRawUnsafe('SELECT * FROM media')){if(!path.resolve(row.local_path).startsWith(path.resolve(legacyRoot)+path.sep))continue;const relative=path.relative(legacyRoot,row.local_path),target=path.join(mediaRoot,relative);if(await exists(row.local_path)&&!await exists(target)){await move(row.local_path,target);moved++;}else if(!await exists(row.local_path)&&!await exists(target)){missing++;continue;}await prisma.$executeRawUnsafe('UPDATE media SET local_path=$1 WHERE id=$2::uuid',target,String(row.id));updated++;}s.json({moved_files:moved,updated_rows:updated,missing_sources:missing,detail:'Legacy media migration completed.'});}));
mediaRouter.get('/:id',asyncHandler(async(q,s)=>{const rows=await prisma.$queryRawUnsafe('SELECT * FROM media WHERE id=$1::uuid',z.string().uuid().parse(q.params.id));if(!rows.length)throw new HttpError(404,'Media not found');s.json(out(rows[0]));}));
mediaRouter.delete('/:id',...requireAdmin,asyncHandler(async(q,s)=>{const id=z.string().uuid().parse(q.params.id),rows=await prisma.$queryRawUnsafe('SELECT * FROM media WHERE id=$1::uuid',id);if(!rows.length)throw new HttpError(404,'Media not found');await remove(rows[0].local_path);await prisma.$executeRawUnsafe('DELETE FROM media WHERE id=$1::uuid',id);s.status(204).end();}));
