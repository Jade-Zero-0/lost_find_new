import { Router } from 'express';
import { adminLogs, logVisit } from '../controllers/log.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware.js';
import { rateLimit } from '../middleware/rate-limit.middleware.js';

const router = Router();

// 公开埋点接口：限流防刷（每 IP 每分钟最多 60 次），避免匿名滥用刷日志占磁盘
router.post('/log/visit', rateLimit({ windowMs: 60_000, max: 60, message: '访问记录过于频繁' }), logVisit);
router.get('/admin/logs', requireAuth, requireAdmin, adminLogs);

export default router;