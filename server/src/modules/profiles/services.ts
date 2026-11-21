import {pool} from '../../db/pool.js';
import {decryptSensitive, encryptSensitive} from '../../core/crypto.js';
import {AppError} from '../../core/errors.js';
import {geoCell} from '../../core/geo.js';
import {getEntitlements} from '../billing/services.js';
import {profileRepository, type ProfileRow} from './repositories.js';

export const calculateAge = (birthDate: string, today = new Date()): number => {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  if (Number.isNaN(birth.valueOf())) throw new AppError(400, 'VALIDATION_ERROR', 'Birth date is invalid.');
  let age = today.getUTCFullYear() - birth.getUTCFullYear();
  if (today.getUTCMonth() < birth.getUTCMonth() || (today.getUTCMonth() === birth.getUTCMonth() && today.getUTCDate() < birth.getUTCDate())) age -= 1;
  return age;
};

type CompletenessProfile = {
  display_name?: string | null | undefined;
  birth_date?: string | null | undefined;
  gender?: string | null | undefined;
  relationship_goal?: string | null | undefined;
  bio?: string | undefined;
  county?: string | null | undefined;
  languages?: string[] | undefined;
};

export const calculateCompleteness = (profile: CompletenessProfile, interestCount: number): number => {
  const checks = [profile.display_name, profile.birth_date, profile.gender, profile.relationship_goal, profile.bio, profile.county, profile.languages?.length, interestCount];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
};

const ownDto = (profile: ProfileRow, interests: unknown[]) => ({
  user_id: profile.user_id, display_name: profile.display_name, birth_date: profile.birth_date, gender: profile.gender,
  show_gender_on_profile: profile.show_gender_on_profile,
  orientation: decryptSensitive(profile.orientation_ciphertext && profile.orientation_iv && profile.orientation_tag ? {ciphertext: profile.orientation_ciphertext, iv: profile.orientation_iv, tag: profile.orientation_tag} : null),
  show_orientation: profile.show_orientation, bio: profile.bio, job_title: profile.job_title, company: profile.company, school: profile.school,
  county: profile.county, hometown: profile.hometown, languages: profile.languages, height_cm: profile.height_cm, relationship_goal: profile.relationship_goal,
  religion: decryptSensitive(profile.religion_ciphertext && profile.religion_iv && profile.religion_tag ? {ciphertext: profile.religion_ciphertext, iv: profile.religion_iv, tag: profile.religion_tag} : null),
  show_religion: profile.show_religion, prompts: profile.prompts, completeness: profile.completeness, is_verified: profile.is_verified,
  verification_status: profile.verification_status, interests,
});

export const getOwnProfile = async (userId: string) => {
  const client = await pool.connect();
  try {
    const profile = await profileRepository.findOwn(client, userId);
    if (!profile) return null;
    return ownDto(profile, await profileRepository.interestsFor(client, userId));
  } finally { client.release(); }
};

export type ProfileUpdate = {displayName?: string | undefined; birthDate?: string | undefined; gender?: string | undefined; showGenderOnProfile?: boolean | undefined; orientation?: string | null | undefined; showOrientation?: boolean | undefined; bio?: string | undefined; jobTitle?: string | undefined; company?: string | undefined; school?: string | undefined; county?: string | undefined; hometown?: string | undefined; languages?: string[] | undefined; heightCm?: number | null | undefined; relationshipGoal?: string | undefined; religion?: string | null | undefined; showReligion?: boolean | undefined; prompts?: unknown[] | undefined; interestIds?: string[] | undefined};

export const updateOwnProfile = async (userId: string, input: ProfileUpdate) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await profileRepository.findOwn(client, userId);
    if (input.birthDate) {
      if (calculateAge(input.birthDate) < 18) throw new AppError(400, 'UNDERAGE', 'Pepper is only available to adults aged 18 or older.');
      if (current?.birth_date && current.birth_date !== input.birthDate) throw new AppError(400, 'BIRTH_DATE_LOCKED', 'Contact support to change your birth date.');
    }
    if (input.interestIds && (input.interestIds.length > 5 || await profileRepository.countValidInterests(client, input.interestIds) !== input.interestIds.length)) throw new AppError(400, 'VALIDATION_ERROR', 'Choose up to five valid interests.');
    const values: Record<string, unknown> = {};
    const mapping: Array<[keyof ProfileUpdate, string]> = [['displayName','display_name'],['birthDate','birth_date'],['gender','gender'],['showGenderOnProfile','show_gender_on_profile'],['showOrientation','show_orientation'],['bio','bio'],['jobTitle','job_title'],['company','company'],['school','school'],['county','county'],['hometown','hometown'],['languages','languages'],['heightCm','height_cm'],['relationshipGoal','relationship_goal'],['showReligion','show_religion'],['prompts','prompts']];
    for (const [key, column] of mapping) if (input[key] !== undefined) values[column] = input[key];
    for (const [key, prefix] of [['orientation','orientation'],['religion','religion']] as const) if (input[key] !== undefined) { const encrypted = encryptSensitive(input[key]); values[`${prefix}_ciphertext`] = encrypted?.ciphertext ?? null; values[`${prefix}_iv`] = encrypted?.iv ?? null; values[`${prefix}_tag`] = encrypted?.tag ?? null; }
    const merged = {...current, display_name: input.displayName ?? current?.display_name, birth_date: input.birthDate ?? current?.birth_date, gender: input.gender ?? current?.gender, relationship_goal: input.relationshipGoal ?? current?.relationship_goal, bio: input.bio ?? current?.bio, county: input.county ?? current?.county, languages: input.languages ?? current?.languages};
    values.completeness = calculateCompleteness(merged, input.interestIds?.length ?? (current ? (await profileRepository.interestsFor(client, userId)).length : 0));
    await profileRepository.upsert(client, userId, values);
    if (input.interestIds) await profileRepository.replaceInterests(client, userId, input.interestIds);
    const updated = await profileRepository.findOwn(client, userId);
    const interests = await profileRepository.interestsFor(client, userId);
    await client.query('COMMIT');
    return ownDto(updated!, interests);
  } catch (error) { await client.query('ROLLBACK').catch(() => undefined); throw error; } finally { client.release(); }
};

export const getPreferences = async (userId: string) => { const client = await pool.connect(); try { return await profileRepository.findPreferences(client, userId); } finally { client.release(); } };
export const updatePreferences = async (userId: string, values: {showMe: string[]; ageMin: number; ageMax: number; maxDistanceKm: number; countiesFilter: string[]; globalMode: boolean; isDiscoverable: boolean}) => { if (values.ageMin > values.ageMax) throw new AppError(400, 'VALIDATION_ERROR', 'Minimum age cannot exceed maximum age.'); const client = await pool.connect(); try { return await profileRepository.upsertPreferences(client, userId, values); } finally { client.release(); } };
export const updateLocation = async (userId: string, values: {latitude: number; longitude: number; accuracyM?: number | undefined; source: 'gps'|'ip'|'manual_county'}) => { const client = await pool.connect(); try { return await profileRepository.upsertLocation(client, userId, {...values, geoCell: geoCell(values.latitude, values.longitude).toString()}); } finally { client.release(); } };
export const listInterests = async () => { const client = await pool.connect(); try { return await profileRepository.listInterests(client); } finally { client.release(); } };
export const updatePassport = async(userId:string,values:{latitude:number;longitude:number;label:string;expiresAt?:string|undefined})=>{if(!(await getEntitlements(userId)).passport)throw new AppError(402,'FEATURE_LOCKED','Passport requires Pepper Plus or higher.',{paywall:'passport'});const client=await pool.connect();try{return await profileRepository.upsertPassport(client,userId,{latitude:values.latitude,longitude:values.longitude,label:values.label,geoCell:geoCell(values.latitude,values.longitude).toString(),...(values.expiresAt?{expiresAt:new Date(values.expiresAt)}:{})});}finally{client.release();}};
export const deletePassport = async(userId:string)=>{const client=await pool.connect();try{await profileRepository.deletePassport(client,userId);}finally{client.release();}};
export const completeOnboarding = async(userId:string)=>{const client=await pool.connect();try{const readiness=await profileRepository.onboardingReadiness(client,userId);const missing:string[]=[];if(!readiness.has_birth_date)missing.push('birth_date');if(!readiness.has_location)missing.push('location');if(Number(readiness.photo_count)<2)missing.push('photos');if(missing.length)throw new AppError(400,'PROFILE_INCOMPLETE','Finish the required onboarding steps.',{missing});await profileRepository.completeOnboarding(client,userId);return{onboarding_completed:true};}finally{client.release();}};
