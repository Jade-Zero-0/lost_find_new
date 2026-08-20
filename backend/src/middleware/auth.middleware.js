import { findUserByToken } from '../services/auth.service.js';
import { fail } from '../utils/response.js';

export function extractToken(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7).trim();
  return null;
}

/** 可选鉴权：有有效 token 则挂载 req.user，不强制 */
export async function attachUser(req, _res, next) {
  try {
    const token = extractToken(req);
    if (token) req.user = await findUserByToken(token);
  } catch {
    req.user = null;
  }
  next();
}

/** 强制登录 */
export async function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) return fail(res, 401, '请先登录');
  try {
    const user = await findUserByToken(token);
    if (!user) return fail(res, 401, '登录已过期，请重新登录');
    req.user = user;
    return next();
  } catch (err) {
    return next(err);
  }
}

/** 管理员权限 */
export function requireAdmin(req, res, next) {
  if (!req.user) return fail(res, 401, '请先登录');
  if (req.user.role !== 'admin') return fail(res, 403, '需要管理员权限');
  return next();
}