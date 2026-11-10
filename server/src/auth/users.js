import { prisma } from '../lib/prisma.js';

const USER_FIELDS = `id, email, full_name, hashed_password, role::text AS role, is_active, is_verified,
  verification_token, google_id, two_factor_enabled, bio, headline, job_title, company, school,
  phone, website, city, country, address, linkedin_url, twitter_url, github_url, created_at, updated_at`;

export async function userById(id) {
  const rows = await prisma.$queryRawUnsafe(`SELECT ${USER_FIELDS} FROM users WHERE id = $1::uuid LIMIT 1`, id);
  return rows[0] ?? null;
}

export async function userByEmail(email) {
  const rows = await prisma.$queryRawUnsafe(`SELECT ${USER_FIELDS} FROM users WHERE email = $1 LIMIT 1`, email);
  return rows[0] ?? null;
}

export async function effectivePermissions(user) {
  if (user.role === 'admin' || user.role === 'superadmin') {
    return ['manage_courses', 'manage_own_courses', 'manage_ecommerce', 'manage_blog', 'manage_tickets', 'manage_users', 'manage_portfolio', 'manage_media', 'manage_forms', 'manage_partners', 'view_analytics', 'manage_roles'];
  }
  const rows = await prisma.$queryRawUnsafe(
    `SELECT sr.permissions FROM user_staff_roles usr JOIN staff_roles sr ON sr.id = usr.role_id WHERE usr.user_id = $1::uuid AND usr.is_active = TRUE`,
    String(user.id),
  );
  return [...new Set(rows.flatMap((row) => row.permissions ?? []))];
}

export function publicUser(user, permissions = []) {
  const fields = ['id', 'email', 'full_name', 'role', 'is_active', 'is_verified', 'two_factor_enabled', 'bio', 'headline', 'job_title', 'company', 'school', 'phone', 'website', 'city', 'country', 'address', 'linkedin_url', 'twitter_url', 'github_url'];
  const result = Object.fromEntries(fields.map((field) => [field, user[field] ?? null]));
  result.id = String(user.id);
  result.two_factor_enabled = Boolean(user.two_factor_enabled);
  result.permissions = permissions;
  result.is_admin = user.role === 'admin' || user.role === 'superadmin';
  return result;
}
