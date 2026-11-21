import {encode} from 'blurhash';
import sharp from 'sharp';
import {pool} from '../../db/pool.js';
import {getModerationProvider} from './providers.js';
import {mediaRepository} from './repositories.js';
import {downloadObject, uploadObject} from './storage.js';

const sizes = {sm: 320, md: 720, lg: 1080} as const;

export const processImageBuffer = async (input: Buffer) => {
  const normalized = sharp(input, {failOn: 'warning'}).rotate();
  const metadata = await normalized.metadata();
  if (!metadata.width || !metadata.height) throw new Error('Image dimensions are unavailable');
  const variants: Record<string, Buffer> = {};
  for (const [name, width] of Object.entries(sizes)) variants[name] = await normalized.clone().resize({width, withoutEnlargement: true}).webp({quality: 82}).toBuffer();
  variants.blur = await normalized.clone().resize({width: 320, withoutEnlargement: true}).blur(18).webp({quality: 55}).toBuffer();
  const {data, info} = await normalized.clone().resize(32, 32, {fit: 'inside'}).ensureAlpha().raw().toBuffer({resolveWithObject: true});
  return {variants, blurhash: encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3), width: metadata.width, height: metadata.height};
};

export const processPhoto = async (photoId: string) => {
  const client = await pool.connect();
  try {
    const photo = await mediaRepository.findPhoto(client, photoId);
    if (!photo) return;
    const processed = await processImageBuffer(await downloadObject(photo.original_key));
    const keys: Record<string,string> = {};
    for (const [name, buffer] of Object.entries(processed.variants)) {
      const key = `processed/${photo.user_id}/${photo.id}/${name}.webp`;
      await uploadObject(key, buffer);
      keys[name] = key;
    }
    const status = await getModerationProvider().review(photo.id);
    await mediaRepository.completeProcessing(client, photo.id, {...processed, variants: keys, status});
  } finally { client.release(); }
};
