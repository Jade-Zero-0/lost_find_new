import { ok } from '../utils/response.js';
import { getAdminStats, getPublicStats } from '../services/stats.service.js';

/** GET /api/stats —— 公开统计（成果展示栏数据看板） */
export async function publicStats(_req, res, next) {
  try {
    return ok(res, await getPublicStats());
  } catch (err) {
    return next(err);
  }
}

/** GET /api/admin/stats —— 管理员统计 */
export async function adminStats(_req, res, next) {
  try {
    return ok(res, await getAdminStats());
  } catch (err) {
    return next(err);
  }
}
