import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from '../config.js';

const here=path.dirname(fileURLToPath(import.meta.url));
export const projectRoot=path.resolve(here,'../..');
export const mediaRoot=path.resolve(projectRoot,config.LOCAL_MEDIA_ROOT);
export const mediaPath=(folder,filename)=>path.join(mediaRoot,folder,filename);
export async function store(folder,filename,bytes){const target=mediaPath(folder,filename);await mkdir(path.dirname(target),{recursive:true});await writeFile(target,bytes);return target;}
export async function remove(localPath){try{await rm(localPath,{force:true});}catch{/* deletion is best-effort for API parity */}}
export async function exists(localPath){try{await stat(localPath);return true;}catch{return false;}}
export async function move(source,target){await mkdir(path.dirname(target),{recursive:true});await rename(source,target);}
export const load=(localPath)=>readFile(localPath);
