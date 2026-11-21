import type {PoolClient} from 'pg';

type DeviceRow = {id: string; platform: 'android'|'ios'|'web'; fcm_token: string; app_version: string; last_seen_at: Date};

export const accountRepository = {
  countRecentChallenges: async (client: PoolClient, phone: string) => {
    const result = await client.query<{count: string}>("SELECT count(*) FROM otp_challenges WHERE phone_e164 = $1 AND created_at > now() - interval '15 minutes'", [phone]);
    return Number(result.rows[0]?.count ?? 0);
  },
  insertChallenge: (client: PoolClient, values: {id: string; phone: string; hash: string; ip?: string}) => client.query(
    "INSERT INTO otp_challenges(id, phone_e164, code_hash, expires_at, ip) VALUES ($1, $2, $3, now() + interval '5 minutes', $4)",
    [values.id, values.phone, values.hash, values.ip ?? null],
  ),
  lockChallenge: async (client: PoolClient, id: string) => (await client.query<{id: string; phone_e164: string; code_hash: string; expires_at: Date; attempts: number; consumed_at: Date | null}>('SELECT * FROM otp_challenges WHERE id = $1 FOR UPDATE', [id])).rows[0],
  consumeChallenge: (client: PoolClient, id: string) => client.query('UPDATE otp_challenges SET consumed_at = now() WHERE id = $1', [id]),
  incrementAttempts: (client: PoolClient, id: string) => client.query('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = $1', [id]),
  upsertUser: async (client: PoolClient, id: string, phone: string) => {
    const result = await client.query<{id: string; inserted: boolean}>('INSERT INTO users(id, phone_e164) VALUES ($1, $2) ON CONFLICT (phone_e164) DO UPDATE SET updated_at = now() RETURNING id, (xmax = 0) AS inserted', [id, phone]);
    return result.rows[0]!;
  },
  insertRefreshToken: (client: PoolClient, values: {id: string; userId: string; tokenHash: string; expiresAt: Date; deviceId?: string}) => client.query('INSERT INTO refresh_tokens(id, user_id, token_hash, expires_at, device_id) VALUES ($1, $2, $3, $4, $5)', [values.id, values.userId, values.tokenHash, values.expiresAt, values.deviceId ?? null]),
  lockRefreshToken: async (client: PoolClient, tokenHash: string) => (await client.query<{id: string; user_id: string; expires_at: Date; revoked_at: Date | null}>('SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = $1 FOR UPDATE', [tokenHash])).rows[0],
  revokeRefreshToken: (client: PoolClient, id: string) => client.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1 AND revoked_at IS NULL', [id]),
  createDevice: async (client: PoolClient, values: {id: string; userId: string; platform: string; fcmToken: string; appVersion: string}) => (await client.query<DeviceRow>('INSERT INTO devices(id, user_id, platform, fcm_token, app_version) VALUES ($1, $2, $3, $4, $5) RETURNING id, platform, fcm_token, app_version, last_seen_at', [values.id, values.userId, values.platform, values.fcmToken, values.appVersion])).rows[0]!,
  deleteDevice: (client: PoolClient, id: string, userId: string) => client.query('DELETE FROM devices WHERE id = $1 AND user_id = $2', [id, userId]),
  findSocialIdentity: async (client: PoolClient, provider: string, subject: string) => (await client.query<{user_id: string}>('SELECT user_id FROM social_identities WHERE provider = $1 AND subject = $2', [provider, subject])).rows[0],
  createSocialUser: async (client: PoolClient, values: {userId: string; identityId: string; provider: string; subject: string; email?: string}) => {
    await client.query('INSERT INTO users(id, email) VALUES ($1, $2)', [values.userId, values.email ?? null]);
    await client.query('INSERT INTO social_identities(id, user_id, provider, subject) VALUES ($1, $2, $3, $4)', [values.identityId, values.userId, values.provider, values.subject]);
  },
};
