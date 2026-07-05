import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { User } from '../models/index.js';
import { AppError } from '../utils/errors.js';

export function generateAccessToken(user) {
  const roles = user.roles || [];
  return jwt.sign(
    { sub: user._id.toString(), email: user.email, roles },
    config.jwt.secret,
    {
      issuer: config.jwt.issuer,
      expiresIn: config.jwt.accessTokenExpirationMs / 1000,
    },
  );
}

export function verifyAccessToken(token) {
  return jwt.verify(token, config.jwt.secret, { issuer: config.jwt.issuer });
}

export async function optionalAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    const user = await User.findById(payload.sub).where({ deletedAt: null });
    if (user) {
      req.user = { id: user._id.toString(), email: user.email, roles: user.roles };
    }
  } catch {
    req.user = null;
  }
  next();
}

export async function requireAuth(req, _res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return next(AppError.unauthorized('Authentication required'));
  }
  try {
    const payload = verifyAccessToken(header.slice(7));
    const user = await User.findById(payload.sub).where({ deletedAt: null });
    if (!user) {
      return next(AppError.unauthorized('User not found'));
    }
    req.user = { id: user._id.toString(), email: user.email, roles: user.roles, _doc: user };
    next();
  } catch {
    next(AppError.unauthorized('Invalid or expired token'));
  }
}

export function requireRoles(...roleNames) {
  const required = roleNames.map((r) => (r.startsWith('ROLE_') ? r : `ROLE_${r}`));
  return (req, _res, next) => {
    if (!req.user) {
      return next(AppError.unauthorized('Authentication required'));
    }
    const hasRole = required.some((r) => req.user.roles.includes(r));
    if (!hasRole) {
      return next(AppError.forbidden());
    }
    next();
  };
}

export function resolveClientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    return String(forwarded).split(',')[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || '';
}
