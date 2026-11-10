import { decodeToken } from './security.js';
import { effectivePermissions, userById } from './users.js';
import { HttpError, asyncHandler } from '../lib/http-error.js';
import { isTokenRevoked, issuedBeforePasswordChange } from '../lib/kv.js';

function bearer(request, required = true) {
  const value = request.get('authorization');
  if (!value?.startsWith('Bearer ')) {
    if (!required) return null;
    throw new HttpError(403, 'Not authenticated');
  }
  return value.slice(7);
}

async function resolveUser(request, optional = false) {
  const token = bearer(request, !optional);
  if (!token) return null;
  try {
    const payload = decodeToken(token, 'access');
    if ((payload.jti && await isTokenRevoked(payload.jti)) || await issuedBeforePasswordChange(payload.sub, payload.iat ?? 0)) {
      throw new HttpError(401, 'Could not validate credentials', { 'WWW-Authenticate': 'Bearer' });
    }
    const user = await userById(payload.sub);
    if (!user || !user.is_active) throw new HttpError(401, 'User not found or inactive');
    request.user = user;
    request.tokenPayload = payload;
    request.rawToken = token;
    return user;
  } catch (error) {
    if (optional) return null;
    throw error;
  }
}

export const requireUser = asyncHandler(async (request, _response, next) => { await resolveUser(request); next(); });
export const optionalUser = asyncHandler(async (request, _response, next) => { await resolveUser(request, true); next(); });

export const requireRoles = (...roles) => [requireUser, (request, _response, next) => {
  if (!roles.includes(request.user.role)) return next(new HttpError(403, 'Insufficient permissions'));
  next();
}];

export const requireAdmin = requireRoles('admin', 'superadmin');
export const requireSuperadmin = requireRoles('superadmin');

export const requirePermissions = (...wanted) => [requireUser, asyncHandler(async (request, _response, next) => {
  if (request.user.role === 'admin' || request.user.role === 'superadmin') return next();
  const permissions = await effectivePermissions(request.user);
  if (!wanted.some((permission) => permissions.includes(permission))) throw new HttpError(403, 'Insufficient permissions');
  request.permissions = permissions;
  next();
})];
