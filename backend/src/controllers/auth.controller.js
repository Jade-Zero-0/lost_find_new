import { fail, ok } from '../utils/response.js';
import { extractToken } from '../middleware/auth.middleware.js';
import { login, logout, register } from '../services/auth.service.js';

/** POST /api/auth/register —— 注册（用户名 + 密码 + 确认密码） */
export async function registerCtrl(req, res, next) {
  try {
    const { username, password, confirmPassword } = req.body || {};
    if (!username || !password) return fail(res, 400, '请填写用户名和密码');
    if (password !== confirmPassword) return fail(res, 400, '两次输入的密码不一致');
    const user = await register({ username, password });
    return ok(res, { user });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/auth/login —— 登录（用户名 + 密码） */
export async function loginCtrl(req, res, next) {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) return fail(res, 400, '请输入用户名和密码');
    const result = await login({ username, password });
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
}

/** POST /api/auth/logout —— 登出 */
export async function logoutCtrl(req, res, next) {
  try {
    await logout(extractToken(req));
    return ok(res, {});
  } catch (err) {
    return next(err);
  }
}

/** GET /api/auth/me —— 当前登录用户 */
export async function meCtrl(req, res, next) {
  try {
    if (!req.user) return fail(res, 401, '请先登录');
    return ok(res, { user: req.user });
  } catch (err) {
    return next(err);
  }
}