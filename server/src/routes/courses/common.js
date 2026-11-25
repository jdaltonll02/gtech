import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { HttpError } from '../../lib/http-error.js';
import { prisma } from '../../lib/prisma.js';

export const uuid=z.string().uuid();
export const newid=()=>randomUUID();
export const one=async(sql,...args)=>{const rows=await prisma.$queryRawUnsafe(sql,...args);if(!rows.length)throw new HttpError(404,'Course resource not found');return rows[0];};
export const courseOne=(id,published=false)=>one(`SELECT * FROM courses WHERE id=$1::uuid${published?' AND is_published=TRUE':''}`,id);
export const courseListOut=(x)=>{const{access_code_hash:_,...safe}=x;return{...safe,price:String(x.price),enrollment_count:Number(x.enrollment_count??0),avg_rating:Number(x.avg_rating??0),rating_count:Number(x.rating_count??0)};};
export const courseDetail=async(id,published=false)=>{
 const course=await courseOne(id,published);
 const prerequisiteRows=await prisma.$queryRawUnsafe('SELECT prerequisite_course_id FROM course_prerequisites WHERE course_id=$1::uuid',id);
 const sections=await prisma.$queryRawUnsafe('SELECT * FROM course_sections WHERE course_id=$1::uuid ORDER BY order_index',id);
 const lessons=await prisma.$queryRawUnsafe('SELECT l.* FROM lessons l JOIN course_sections s ON s.id=l.section_id WHERE s.course_id=$1::uuid ORDER BY l.order_index',id);
 const make=(s)=>({...s,lessons:lessons.filter((l)=>String(l.section_id)===String(s.id)).map(({video_url:_,content:__,...l})=>l),sub_sections:[]});
 const built=sections.map(make), roots=built.filter((s)=>!s.parent_id);
 for(const s of built.filter((x)=>x.parent_id)){const p=built.find((x)=>String(x.id)===String(s.parent_id));if(p)p.sub_sections.push(s);}
 return {...courseListOut(course),prerequisite_course_ids:prerequisiteRows.map((row)=>String(row.prerequisite_course_id)),sections:roots};
};
export const parsePatch=(schema,body)=>schema.partial().parse(body);
export const patchRow=async(table,id,data,notFound='Course resource not found')=>{
 const entries=Object.entries(data).filter(([,v])=>v!==undefined);
 if(!entries.length)return one(`SELECT * FROM ${table} WHERE id=$1::uuid`,id);
 const vals=entries.map(([,v])=>v);vals.push(id);
 const stamp=['course_sections','quiz_questions'].includes(table)?'':',updated_at=NOW()';
 const rows=await prisma.$queryRawUnsafe(`UPDATE ${table} SET ${entries.map(([k],i)=>`${k}=$${i+1}`).join(',')}${stamp} WHERE id=$${vals.length}::uuid RETURNING *`,...vals);
 if(!rows.length)throw new HttpError(404,notFound);return rows[0];
};
