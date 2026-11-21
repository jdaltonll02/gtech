import {DeleteObjectsCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import {config} from '../../config.js';

const credentials = {accessKeyId: config.S3_ACCESS_KEY, secretAccessKey: config.S3_SECRET_KEY};
const clientOptions = {region: 'us-east-1', credentials, forcePathStyle: true};
const storageClient = new S3Client({...clientOptions, endpoint: config.S3_ENDPOINT_URL});
const signingClient = new S3Client({...clientOptions, endpoint: config.S3_PUBLIC_ENDPOINT_URL});

export const createUploadUrl = async (key: string, contentType: string, contentLength?: number) => ({
  uploadUrl: await getSignedUrl(signingClient, new PutObjectCommand({Bucket: config.S3_BUCKET, Key: key, ContentType: contentType,...(contentLength===undefined?{}:{ContentLength:contentLength})}), {expiresIn: 300}),
  headers: {'content-type': contentType,...(contentLength===undefined?{}:{'content-length':String(contentLength)})},
});
export const createDownloadUrl=(key:string)=>getSignedUrl(signingClient,new GetObjectCommand({Bucket:config.S3_BUCKET,Key:key}),{expiresIn:900});

export const inspectObject = async (key: string) => storageClient.send(new HeadObjectCommand({Bucket: config.S3_BUCKET, Key: key}));
export const downloadObject = async (key: string): Promise<Buffer> => {
  const result = await storageClient.send(new GetObjectCommand({Bucket: config.S3_BUCKET, Key: key}));
  if (!result.Body) throw new Error(`Object ${key} has no body`);
  return Buffer.from(await result.Body.transformToByteArray());
};
export const uploadObject = async (key: string, body: Buffer,contentType='image/webp') => storageClient.send(new PutObjectCommand({Bucket: config.S3_BUCKET, Key: key, Body: body, ContentType:contentType}));
export const deleteObjects = async (keys: string[]) => keys.length ? storageClient.send(new DeleteObjectsCommand({Bucket: config.S3_BUCKET, Delete: {Objects: keys.map((Key) => ({Key}))}})) : undefined;
