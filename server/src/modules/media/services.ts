import {v7 as uuid7} from 'uuid';
import {AppError} from '../../core/errors.js';
import {pool} from '../../db/pool.js';
import {mediaQueue} from './queue.js';
import {mediaRepository} from './repositories.js';
import {createUploadUrl, deleteObjects, inspectObject} from './storage.js';

const allowedTypes = new Set(['image/jpeg','image/png','image/webp','image/heic','image/heif']);
const maxBytes = 10 * 1024 * 1024;

export const requestPhotoUpload = async (userId: string, contentType: string, contentLength: number) => {
  if (!allowedTypes.has(contentType) || contentLength < 1 || contentLength > maxBytes) throw new AppError(400, 'VALIDATION_ERROR', 'Upload an image no larger than 10 MB.');
  const key = `original/${userId}/${uuid7()}`;
  const signed = await createUploadUrl(key, contentType, contentLength);
  return {upload_url:signed.uploadUrl,key,expires_in:300,required_headers:signed.headers};
};

export const confirmPhoto = async (userId: string, key: string, position: number) => {
  if (!key.startsWith(`original/${userId}/`)) throw new AppError(403, 'PERMISSION_DENIED', 'That upload does not belong to this account.');
  const object = await inspectObject(key).catch(() => { throw new AppError(400, 'UPLOAD_NOT_FOUND', 'Upload the image before confirming it.'); });
  if (!object.ContentType || !allowedTypes.has(object.ContentType) || !object.ContentLength || object.ContentLength > maxBytes) throw new AppError(400, 'INVALID_IMAGE', 'The uploaded object is not a supported image.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    if (await mediaRepository.countPhotos(client,userId) >= 9) throw new AppError(400, 'PHOTO_LIMIT_REACHED', 'A profile can have up to nine photos.');
    const photo = await mediaRepository.insertPhoto(client,{id:uuid7(),userId,position,key});
    await client.query('COMMIT');
    await mediaQueue.add('process-photo',{photoId:photo.id},{attempts:3,backoff:{type:'exponential',delay:1000},removeOnComplete:100,removeOnFail:100});
    return photo;
  } catch(error) { await client.query('ROLLBACK').catch(()=>undefined); throw error; } finally { client.release(); }
};

export const reorderPhotos = async (userId: string, photoIds: string[]) => {
  if (new Set(photoIds).size !== photoIds.length) throw new AppError(400,'VALIDATION_ERROR','Photo IDs must be unique.');
  const client=await pool.connect();
  try { await client.query('BEGIN'); const current=await mediaRepository.photosForUser(client,userId); if (current.length!==photoIds.length || current.some((photo)=>!photoIds.includes(photo.id))) throw new AppError(403,'PERMISSION_DENIED','Submit every photo owned by this account.'); await mediaRepository.reorder(client,userId,photoIds); await client.query('COMMIT'); return await mediaRepository.photosForUser(client,userId); } catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;} finally{client.release();}
};

export const removePhoto = async (userId: string, photoId: string) => {
  const client=await pool.connect();
  try { const photo=await mediaRepository.deletePhoto(client,photoId,userId); if(!photo) throw new AppError(404,'NOT_FOUND','Photo not found.'); await deleteObjects([photo.original_key,...Object.values(photo.variants)]); } finally{client.release();}
};
