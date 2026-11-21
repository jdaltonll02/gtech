import type {PoolClient} from 'pg';

export type ProfileRow = {
  user_id: string; display_name: string | null; birth_date: string | null; gender: string | null; show_gender_on_profile: boolean;
  orientation_ciphertext: Buffer | null; orientation_iv: Buffer | null; orientation_tag: Buffer | null; show_orientation: boolean;
  bio: string; job_title: string; company: string; school: string; county: string | null; hometown: string; languages: string[];
  height_cm: number | null; relationship_goal: string | null; religion_ciphertext: Buffer | null; religion_iv: Buffer | null;
  religion_tag: Buffer | null; show_religion: boolean; prompts: unknown[]; completeness: number; is_verified: boolean; verification_status: string;
};
export type PreferenceRow = {user_id:string;show_me:string[];age_min:number;age_max:number;max_distance_km:number;counties_filter:string[];global_mode:boolean;is_discoverable:boolean};
export type LocationResult = {geo_cell:string;accuracy_m:number|null;source:string;updated_at:Date};
export type PassportResult = {label:string;expires_at:Date|null;created_at:Date};

export const profileRepository = {
  findOwn: async (client: PoolClient, userId: string) => (await client.query<ProfileRow>('SELECT * FROM profiles WHERE user_id = $1', [userId])).rows[0],
  upsert: async (client: PoolClient, userId: string, values: Record<string, unknown>) => {
    const columns = Object.keys(values);
    const parameters = Object.values(values);
    if (!columns.length) return;
    const placeholders = columns.map((_column, index) => `$${index + 2}`).join(', ');
    const assignments = columns.map((column) => `${column} = EXCLUDED.${column}`).join(', ');
    await client.query(`INSERT INTO profiles(user_id, ${columns.join(', ')}) VALUES ($1, ${placeholders}) ON CONFLICT (user_id) DO UPDATE SET ${assignments}, updated_at = now()`, [userId, ...parameters]);
  },
  replaceInterests: async (client: PoolClient, userId: string, interestIds: string[]) => {
    await client.query('DELETE FROM profile_interests WHERE user_id = $1', [userId]);
    if (interestIds.length) await client.query('INSERT INTO profile_interests(user_id, interest_id) SELECT $1, unnest($2::uuid[])', [userId, interestIds]);
  },
  interestsFor: async (client: PoolClient, userId: string) => (await client.query<{id: string; slug: string; label: string}>('SELECT i.id, i.slug, i.label FROM interests i JOIN profile_interests pi ON pi.interest_id = i.id WHERE pi.user_id = $1 ORDER BY i.sort_order', [userId])).rows,
  listInterests: async (client: PoolClient) => (await client.query<{id: string; slug: string; label: string}>('SELECT id, slug, label FROM interests ORDER BY sort_order, label')).rows,
  countValidInterests: async (client: PoolClient, ids: string[]) => Number((await client.query<{count: string}>('SELECT count(*) FROM interests WHERE id = ANY($1::uuid[])', [ids])).rows[0]?.count ?? 0),
  findPreferences: async (client: PoolClient, userId: string) => (await client.query<PreferenceRow>('SELECT * FROM discovery_preferences WHERE user_id = $1', [userId])).rows[0] ?? null,
  upsertPreferences: async (client: PoolClient, userId: string, values: {showMe: string[]; ageMin: number; ageMax: number; maxDistanceKm: number; countiesFilter: string[]; globalMode: boolean; isDiscoverable: boolean}) => (await client.query<PreferenceRow>('INSERT INTO discovery_preferences(user_id, show_me, age_min, age_max, max_distance_km, counties_filter, global_mode, is_discoverable) VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (user_id) DO UPDATE SET show_me=EXCLUDED.show_me, age_min=EXCLUDED.age_min, age_max=EXCLUDED.age_max, max_distance_km=EXCLUDED.max_distance_km, counties_filter=EXCLUDED.counties_filter, global_mode=EXCLUDED.global_mode, is_discoverable=EXCLUDED.is_discoverable RETURNING *', [userId, values.showMe, values.ageMin, values.ageMax, values.maxDistanceKm, values.countiesFilter, values.globalMode, values.isDiscoverable])).rows[0]!,
  upsertLocation: async (client: PoolClient, userId: string, values: {latitude: number; longitude: number; geoCell: string; accuracyM?: number | undefined; source: string}) => (await client.query<LocationResult>('INSERT INTO locations(user_id, point, geo_cell, accuracy_m, source) VALUES ($1, ST_SetSRID(ST_MakePoint($2,$3),4326)::geography, $4, $5, $6) ON CONFLICT (user_id) DO UPDATE SET point=EXCLUDED.point, geo_cell=EXCLUDED.geo_cell, accuracy_m=EXCLUDED.accuracy_m, source=EXCLUDED.source, updated_at=now() RETURNING geo_cell::text, accuracy_m, source, updated_at', [userId, values.longitude, values.latitude, values.geoCell, values.accuracyM ?? null, values.source])).rows[0]!,
  upsertPassport: async (client: PoolClient, userId: string, values: {latitude:number;longitude:number;label:string;geoCell:string;expiresAt?:Date|undefined}) => (await client.query<PassportResult>('INSERT INTO passport_locations(user_id,point,label,geo_cell,expires_at) VALUES($1,ST_SetSRID(ST_MakePoint($2,$3),4326)::geography,$4,$5,$6) ON CONFLICT(user_id) DO UPDATE SET point=EXCLUDED.point,label=EXCLUDED.label,geo_cell=EXCLUDED.geo_cell,expires_at=EXCLUDED.expires_at,created_at=now() RETURNING label,expires_at,created_at',[userId,values.longitude,values.latitude,values.label,values.geoCell,values.expiresAt??null])).rows[0]!,
  deletePassport: (client:PoolClient,userId:string)=>client.query('DELETE FROM passport_locations WHERE user_id=$1',[userId]),
  onboardingReadiness: async(client:PoolClient,userId:string)=>(await client.query<{has_birth_date:boolean;has_location:boolean;photo_count:string}>('SELECT EXISTS(SELECT 1 FROM profiles WHERE user_id=$1 AND birth_date IS NOT NULL) AS has_birth_date, EXISTS(SELECT 1 FROM locations WHERE user_id=$1) AS has_location, (SELECT count(*) FROM photos WHERE user_id=$1 AND moderation_status IN (\'pending\',\'approved\'))::text AS photo_count',[userId])).rows[0]!,
  completeOnboarding: (client:PoolClient,userId:string)=>client.query('UPDATE users SET onboarding_completed=true,updated_at=now() WHERE id=$1',[userId]),
};
