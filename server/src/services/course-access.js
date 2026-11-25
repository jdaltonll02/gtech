import { asyncHandler, HttpError } from '../lib/http-error.js';
import { prisma } from '../lib/prisma.js';

export async function managedCourseIds(user){
  if(['admin','superadmin'].includes(user.role))return null;
  const rows=await prisma.$queryRawUnsafe('SELECT sr.permissions,usr.role_metadata FROM user_staff_roles usr JOIN staff_roles sr ON sr.id=usr.role_id WHERE usr.user_id=$1::uuid AND usr.is_active=TRUE',String(user.id));
  if(rows.some((row)=>(row.permissions??[]).includes('manage_courses')))return null;
  const ids=new Set();
  for(const row of rows){
    if(!(row.permissions??[]).includes('manage_own_courses'))continue;
    for(const id of row.role_metadata?.course_ids??[])ids.add(String(id));
  }
  const assigned=await prisma.$queryRawUnsafe('SELECT course_id FROM course_instructors WHERE user_id=$1::uuid',String(user.id));
  for(const row of assigned)ids.add(String(row.course_id));
  return [...ids];
}

export async function assertCourseManager(user,courseId){
  const ids=await managedCourseIds(user);
  if(ids!==null&&!ids.includes(String(courseId)))throw new HttpError(403,'You do not manage this course');
  return String(courseId);
}

const resourceQueries={
  course:'SELECT id course_id FROM courses WHERE id=$1::uuid',
  section:'SELECT course_id FROM course_sections WHERE id=$1::uuid',
  lesson:'SELECT cs.course_id FROM lessons l JOIN course_sections cs ON cs.id=l.section_id WHERE l.id=$1::uuid',
  block:'SELECT cs.course_id FROM content_blocks b JOIN lessons l ON l.id=b.lesson_id JOIN course_sections cs ON cs.id=l.section_id WHERE b.id=$1::uuid',
  assessment:'SELECT cs.course_id FROM assessments a JOIN lessons l ON l.id=a.lesson_id JOIN course_sections cs ON cs.id=l.section_id WHERE a.id=$1::uuid',
  question:'SELECT cs.course_id FROM quiz_questions qq JOIN assessments a ON a.id=qq.assessment_id JOIN lessons l ON l.id=a.lesson_id JOIN course_sections cs ON cs.id=l.section_id WHERE qq.id=$1::uuid',
  submission:'SELECT cs.course_id FROM assignment_submissions sub JOIN assessments a ON a.id=sub.assessment_id JOIN lessons l ON l.id=a.lesson_id JOIN course_sections cs ON cs.id=l.section_id WHERE sub.id=$1::uuid',
  enrollment:'SELECT course_id FROM enrollments WHERE id=$1::uuid',
};

export const requireManagedCourse=(resource,param)=>asyncHandler(async(request,_response,next)=>{
  const query=resourceQueries[resource];
  if(!query)throw new Error(`Unknown course resource: ${resource}`);
  const rows=await prisma.$queryRawUnsafe(query,request.params[param]);
  if(!rows.length)throw new HttpError(404,'Course resource not found');
  await assertCourseManager(request.user,rows[0].course_id);
  request.managedCourseId=String(rows[0].course_id);
  next();
});
