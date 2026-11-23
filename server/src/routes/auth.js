import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { Router } from 'express';
import { config } from '../config.js';
import { requireUser } from '../auth/middleware.js';
import { createAccessToken, createRefreshToken, decodeToken, hashPassword, tokenResponse, verifyPassword } from '../auth/security.js';
import { effectivePermissions, publicUser, userByEmail, userById } from '../auth/users.js';
import { asyncHandler, HttpError } from '../lib/http-error.js';
import { del, get, increment, revokeToken, set, setPasswordChanged } from '../lib/kv.js';
import { prisma } from '../lib/prisma.js';
import { enqueue } from '../jobs/runner.js';
import { sendPasswordResetEmail, sendTwoFactorCode, sendVerificationEmail, sendWelcomeEmail } from '../services/email.js';
import { forgotSchema, loginSchema, refreshSchema, registerSchema, resendSchema, resetSchema, twoFactorSchema, updateProfileSchema } from '../validation/auth.js';
import { limit3, limit5, limit10 } from '../middleware/security.js';

export const authRouter = Router();
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const otp = () => String(randomInt(0, 1_000_000)).padStart(6, '0');
const hint = (email) => `${email.slice(0, 2)}***@${email.split('@')[1]}`;
const LOCKOUT_TTL = 15 * 60;

authRouter.post('/forgot-password', limit3, asyncHandler(async (request, response) => {
  const { email } = forgotSchema.parse(request.body);
  const user = await userByEmail(email);
  const message = { message: 'If an account exists, a reset link has been sent.' };
  if (!user?.is_active) return response.json(message);
  const rawToken = randomBytes(32).toString('base64url');
  const tokenHash = sha256(rawToken);
  await prisma.$transaction([
    prisma.$executeRawUnsafe('UPDATE password_reset_tokens SET used_at = NOW() WHERE user_id = $1::uuid AND used_at IS NULL', String(user.id)),
    prisma.$executeRawUnsafe('INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at, created_at) VALUES ($1::uuid, $2::uuid, $3, NOW() + INTERVAL \'1 hour\', NOW())', randomUUID(), String(user.id), tokenHash),
  ]);
  const resetUrl = `${config.FRONTEND_URL}/reset-password?token=${rawToken}`;
  enqueue('send_password_reset', () => sendPasswordResetEmail(user.email, user.full_name, resetUrl));
  return response.json(message);
}));

authRouter.post('/reset-password', asyncHandler(async (request, response) => {
  const payload = resetSchema.parse(request.body);
  const rows = await prisma.$queryRawUnsafe('SELECT * FROM password_reset_tokens WHERE token_hash = $1 AND used_at IS NULL LIMIT 1', sha256(payload.token));
  const record = rows[0];
  if (!record || new Date(record.expires_at) < new Date()) throw new HttpError(400, 'Invalid or expired reset link.');
  const user = await userById(record.user_id);
  if (!user) throw new HttpError(404, 'User not found.');
  const hashed = await hashPassword(payload.new_password);
  await prisma.$transaction([
    prisma.$executeRawUnsafe('UPDATE users SET hashed_password = $1, updated_at = NOW() WHERE id = $2::uuid', hashed, String(user.id)),
    prisma.$executeRawUnsafe('UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1::uuid', String(record.id)),
  ]);
  await setPasswordChanged(String(user.id), Date.now() / 1000, config.ACCESS_TOKEN_EXPIRE_MINUTES * 60);
  response.json({ message: 'Password reset successfully. You can now sign in.' });
}));

authRouter.post('/2fa/send-code', requireUser, asyncHandler(async (request, response) => {
  const code = otp();
  await set(`2fa:${request.user.id}`, sha256(code), 600);
  enqueue('send_2fa_code', () => sendTwoFactorCode(request.user.email, request.user.full_name, code));
  response.json({ message: 'Code sent.', hint: hint(request.user.email) });
}));

authRouter.post('/2fa/verify', limit5, asyncHandler(async (request, response) => {
  const payload = twoFactorSchema.parse(request.body);
  const stored = await get(`2fa:${payload.user_id}`);
  if (!stored) throw new HttpError(400, 'Code expired or not found. Request a new one.');
  if (sha256(payload.code) !== stored) throw new HttpError(400, 'Invalid verification code.');
  await del(`2fa:${payload.user_id}`);
  response.json(tokenResponse(payload.user_id));
}));

authRouter.post('/2fa/enable', requireUser, asyncHandler(async (request, response) => {
  await prisma.$executeRawUnsafe('UPDATE users SET two_factor_enabled = TRUE, updated_at = NOW() WHERE id = $1::uuid', String(request.user.id));
  response.json({ message: 'Two-factor authentication enabled.' });
}));

authRouter.post('/2fa/disable', requireUser, asyncHandler(async (request, response) => {
  await prisma.$executeRawUnsafe('UPDATE users SET two_factor_enabled = FALSE, updated_at = NOW() WHERE id = $1::uuid', String(request.user.id));
  await del(`2fa:${request.user.id}`);
  response.json({ message: 'Two-factor authentication disabled.' });
}));

authRouter.post('/register', limit5, asyncHandler(async (request, response) => {
  const payload = registerSchema.parse(request.body);
  const generic = { message: 'If this email is not already registered, you will receive a verification email shortly.' };
  if (await userByEmail(payload.email)) return response.json(generic);
  const token = randomBytes(32).toString('base64url');
  const id = randomUUID();
  const hashed = await hashPassword(payload.password);
  await prisma.$executeRawUnsafe(
    `INSERT INTO users (id, email, full_name, hashed_password, role, is_active, is_verified, verification_token, two_factor_enabled, created_at, updated_at)
     VALUES ($1::uuid, $2, $3, $4, 'user', TRUE, FALSE, $5, FALSE, NOW(), NOW())`,
    id, payload.email, payload.full_name, hashed, token,
  );
  enqueue('send_verification_email', () => sendVerificationEmail(payload.email, payload.full_name, token));
  response.json(generic);
}));

authRouter.post('/login', limit10, asyncHandler(async (request, response) => {
  const payload = loginSchema.parse(request.body);
  const lockoutKey = `lockout:${payload.email}`;
  if (Number(await get(lockoutKey) ?? 0) >= 10) throw new HttpError(429, 'Account temporarily locked due to repeated failures. Try again in 15 minutes.');
  const user = await userByEmail(payload.email);
  if (!user || !(await verifyPassword(payload.password, user.hashed_password))) {
    await increment(lockoutKey, LOCKOUT_TTL);
    throw new HttpError(401, 'Invalid credentials');
  }
  await del(lockoutKey);
  if (!user.is_active) throw new HttpError(403, 'Account disabled');
  if (!user.is_verified) throw new HttpError(403, 'email_not_verified');
  if (user.two_factor_enabled) {
    const code = otp();
    await set(`2fa:${user.id}`, sha256(code), 600);
    enqueue('send_2fa_code', () => sendTwoFactorCode(user.email, user.full_name, code));
    return response.json({ requires_2fa: true, user_id: String(user.id), hint: hint(user.email) });
  }
  response.json(tokenResponse(user.id));
}));

authRouter.post('/logout', requireUser, asyncHandler(async (request, response) => {
  const payload = request.tokenPayload;
  if (payload.jti) await revokeToken(payload.jti, Math.max(1, payload.exp - Math.floor(Date.now() / 1000)));
  response.json({ message: 'Logged out successfully.' });
}));

authRouter.post('/refresh', asyncHandler(async (request, response) => {
  const { refresh_token } = refreshSchema.parse(request.body);
  const payload = decodeToken(refresh_token, 'refresh');
  const user = await userById(payload.sub);
  if (!user?.is_active) throw new HttpError(401, 'Invalid token');
  response.json(tokenResponse(user.id));
}));

authRouter.get('/me', requireUser, asyncHandler(async (request, response) => {
  response.json(publicUser(request.user, await effectivePermissions(request.user)));
}));

authRouter.patch('/me', requireUser, asyncHandler(async (request, response) => {
  const payload = updateProfileSchema.parse(request.body);
  const updates = [];
  const values = [];
  let passwordChanged = false;
  if (payload.new_password) {
    if (!payload.current_password) throw new HttpError(422, 'current_password is required to set a new password');
    if (!(await verifyPassword(payload.current_password, request.user.hashed_password))) throw new HttpError(400, 'Current password is incorrect');
    updates.push(`hashed_password = $${values.push(await hashPassword(payload.new_password))}`);
    passwordChanged = true;
  }
  if (payload.email && payload.email !== request.user.email) {
    if (await userByEmail(payload.email)) throw new HttpError(409, 'Email already in use');
    updates.push(`email = $${values.push(payload.email)}`);
  }
  if (payload.full_name) updates.push(`full_name = $${values.push(payload.full_name.trim())}`);
  const fields = ['bio', 'headline', 'job_title', 'company', 'school', 'phone', 'website', 'city', 'country', 'address', 'linkedin_url', 'twitter_url', 'github_url'];
  for (const field of fields) if (payload[field] !== undefined) updates.push(`${field} = $${values.push(payload[field] || null)}`);
  if (updates.length) {
    values.push(String(request.user.id));
    await prisma.$executeRawUnsafe(`UPDATE users SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${values.length}::uuid`, ...values);
  }
  if (passwordChanged) await setPasswordChanged(String(request.user.id), Date.now() / 1000, config.ACCESS_TOKEN_EXPIRE_MINUTES * 60);
  const updated = await userById(request.user.id);
  response.json(publicUser(updated, await effectivePermissions(updated)));
}));

authRouter.post('/verify-email', limit10, asyncHandler(async (request, response) => {
  const token = String(request.query.token ?? '');
  const rows = await prisma.$queryRawUnsafe('SELECT id, email, full_name, is_verified FROM users WHERE verification_token = $1 LIMIT 1', token);
  const user = rows[0];
  if (!user) throw new HttpError(400, 'Invalid or expired verification token');
  if (user.is_verified) return response.json({ message: 'Email already verified' });
  await prisma.$executeRawUnsafe('UPDATE users SET is_verified = TRUE, verification_token = NULL, updated_at = NOW() WHERE id = $1::uuid', String(user.id));
  enqueue('send_welcome_email', () => sendWelcomeEmail(user.email, user.full_name));
  return response.json({ message: 'Email verified successfully' });
}));

authRouter.post('/resend-verification', limit3, asyncHandler(async (request, response) => {
  const { email } = resendSchema.parse(request.body);
  const user = await userByEmail(email);
  if (!user || user.is_verified) return response.json({ message: 'If this account exists and is unverified, a new verification email has been sent.' });
  const token = randomBytes(32).toString('base64url');
  await prisma.$executeRawUnsafe('UPDATE users SET verification_token = $1, updated_at = NOW() WHERE id = $2::uuid', token, String(user.id));
  enqueue('send_verification_email', () => sendVerificationEmail(user.email, user.full_name, token));
  return response.json({ message: 'Verification email sent. Please check your inbox.' });
}));

authRouter.get('/oauth-token', asyncHandler(async (request, response) => {
  const key = `oauth_state:${String(request.query.state ?? '')}`;
  const data = await get(key);
  if (!data) throw new HttpError(400, 'Invalid or expired OAuth state.');
  await del(key);
  response.json(data);
}));

authRouter.get('/google', (_request, response) => {
  const params = new URLSearchParams({ client_id: config.GOOGLE_CLIENT_ID, redirect_uri: config.GOOGLE_REDIRECT_URI, response_type: 'code', scope: 'openid email profile', access_type: 'offline', prompt: 'consent' });
  response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
});

authRouter.get('/google/callback', asyncHandler(async (request, response) => {
  const tokenResponseRaw = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ code: String(request.query.code ?? ''), client_id: config.GOOGLE_CLIENT_ID, client_secret: config.GOOGLE_CLIENT_SECRET, redirect_uri: config.GOOGLE_REDIRECT_URI, grant_type: 'authorization_code' }) });
  if (!tokenResponseRaw.ok) throw new HttpError(502, 'Google authentication failed');
  const googleToken = await tokenResponseRaw.json();
  const infoResponse = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { authorization: `Bearer ${googleToken.access_token}` } });
  if (!infoResponse.ok) throw new HttpError(502, 'Google authentication failed');
  const info = await infoResponse.json();
  let user = await userByEmail(info.email);
  if (user) await prisma.$executeRawUnsafe('UPDATE users SET google_id = $1, is_verified = TRUE, updated_at = NOW() WHERE id = $2::uuid', info.sub, String(user.id));
  else {
    const id = randomUUID();
    await prisma.$executeRawUnsafe(`INSERT INTO users (id,email,full_name,hashed_password,role,is_active,is_verified,google_id,two_factor_enabled,created_at,updated_at) VALUES ($1::uuid,$2,$3,$4,'user',TRUE,TRUE,$5,FALSE,NOW(),NOW())`, id, info.email, info.name ?? info.email.split('@')[0], await hashPassword(randomBytes(16).toString('hex')), info.sub);
    user = await userById(id);
  }
  user = await userByEmail(info.email);
  if (!user.is_active) return response.redirect(`${config.FRONTEND_URL}/login?error=account_disabled`);
  const stateKey = randomBytes(32).toString('base64url');
  await set(`oauth_state:${stateKey}`, { access_token: createAccessToken(user.id), refresh_token: createRefreshToken(user.id) }, 120);
  response.redirect(`${config.FRONTEND_URL}/login?oauth_state=${stateKey}`);
}));
