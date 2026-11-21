import {Router} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {authenticate, authenticatedUserId} from '../../core/auth.js';
import {counties, languages, prompts} from './meta.js';
import {completeOnboarding,deletePassport,getOwnProfile, getPreferences, listInterests, updateLocation, updateOwnProfile, updatePassport,updatePreferences} from './services.js';

const gender = z.enum(['woman', 'man', 'nonbinary']);
const writeLimit = rateLimit({windowMs: 60_000, limit: 30});
export const profilesRouter = Router();

profilesRouter.get('/profiles/me', authenticate, async (request, response) => response.json(await getOwnProfile(authenticatedUserId(request))));
profilesRouter.patch('/profiles/me', authenticate, writeLimit, async (request, response) => {
  const body = z.object({display_name:z.string().trim().min(1).max(80).optional(),birth_date:z.iso.date().optional(),gender:gender.optional(),show_gender_on_profile:z.boolean().optional(),orientation:z.string().max(80).nullable().optional(),show_orientation:z.boolean().optional(),bio:z.string().max(500).optional(),job_title:z.string().max(100).optional(),company:z.string().max(100).optional(),school:z.string().max(120).optional(),county:z.string().max(80).optional(),hometown:z.string().max(120).optional(),languages:z.array(z.string().max(40)).max(10).optional(),height_cm:z.number().int().min(90).max(250).nullable().optional(),relationship_goal:z.enum(['long_term','long_term_open','short_term_open','short_term','friends','figuring_out']).optional(),religion:z.string().max(80).nullable().optional(),show_religion:z.boolean().optional(),prompts:z.array(z.object({prompt:z.string().max(160),answer:z.string().max(300)})).max(3).optional(),interest_ids:z.array(z.string().uuid()).max(5).optional()}).strict().parse(request.body);
  response.json(await updateOwnProfile(authenticatedUserId(request), {displayName:body.display_name,birthDate:body.birth_date,gender:body.gender,showGenderOnProfile:body.show_gender_on_profile,orientation:body.orientation,showOrientation:body.show_orientation,bio:body.bio,jobTitle:body.job_title,company:body.company,school:body.school,county:body.county,hometown:body.hometown,languages:body.languages,heightCm:body.height_cm,relationshipGoal:body.relationship_goal,religion:body.religion,showReligion:body.show_religion,prompts:body.prompts,interestIds:body.interest_ids}));
});
profilesRouter.get('/profiles/me/preferences', authenticate, async (request, response) => response.json(await getPreferences(authenticatedUserId(request))));
profilesRouter.patch('/profiles/me/preferences', authenticate, writeLimit, async (request, response) => {
  const body=z.object({show_me:z.array(gender).min(1),age_min:z.number().int().min(18).max(100),age_max:z.number().int().min(18).max(100),max_distance_km:z.number().int().min(2).max(160),counties_filter:z.array(z.string()).max(16).default([]),global_mode:z.boolean().default(false),is_discoverable:z.boolean().default(true)}).parse(request.body);
  response.json(await updatePreferences(authenticatedUserId(request), {showMe:body.show_me,ageMin:body.age_min,ageMax:body.age_max,maxDistanceKm:body.max_distance_km,countiesFilter:body.counties_filter,globalMode:body.global_mode,isDiscoverable:body.is_discoverable}));
});
profilesRouter.put('/profiles/me/location', authenticate, writeLimit, async (request,response)=>{const body=z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),accuracy_m:z.number().nonnegative().optional(),source:z.enum(['gps','ip','manual_county'])}).parse(request.body);response.json(await updateLocation(authenticatedUserId(request),{latitude:body.latitude,longitude:body.longitude,accuracyM:body.accuracy_m,source:body.source}));});
profilesRouter.put('/profiles/me/passport',authenticate,writeLimit,async(request,response)=>{const body=z.object({latitude:z.number().min(-90).max(90),longitude:z.number().min(-180).max(180),label:z.string().trim().min(1).max(120),expires_at:z.iso.datetime().optional()}).strict().parse(request.body);response.json(await updatePassport(authenticatedUserId(request),{latitude:body.latitude,longitude:body.longitude,label:body.label,expiresAt:body.expires_at}));});
profilesRouter.delete('/profiles/me/passport',authenticate,writeLimit,async(request,response)=>{await deletePassport(authenticatedUserId(request));response.status(204).end();});
profilesRouter.post('/profiles/me/complete',authenticate,writeLimit,async(request,response)=>response.json(await completeOnboarding(authenticatedUserId(request))));
profilesRouter.get('/meta/interests', async (_request,response)=>response.json({results:await listInterests()}));
profilesRouter.get('/meta/counties', (_request,response)=>response.json({results:counties}));
profilesRouter.get('/meta/languages', (_request,response)=>response.json({results:languages}));
profilesRouter.get('/meta/prompts', (_request,response)=>response.json({results:prompts}));
