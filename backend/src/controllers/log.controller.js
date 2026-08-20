import { ok } from '../utils/response.js';
import { addLog, getLogs } from '../services/log.service.js';

/** POST /api/log/visit —— 前端页面访问上报（公开） */
export async function logVisit(req, res, next) {
  try {
    await addLog({
      type: 'visit',
      page: String((req.body && req.body.page) || '').slice(0, 100),
      user: req.user ? req.user.username : null
    });
    return ok(res, {});
  } catch (err) {
    return next(err);
  }
}

/** GET /api/admin/logs —— 管理员查看访问/操作日志 */
export async function adminLogs(req, res, next) {
  try {
    const limit = Math.min(parseInt(String(req.query.limit || 200), 10) || 200, 500);
    return ok(res, { logs: await getLogs(limit) });
  } catch (err) {
    return next(err);
  }
}