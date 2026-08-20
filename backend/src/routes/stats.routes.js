import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware.js';
import { adminStats, publicStats } from '../controllers/stats.controller.js';

const router = Router();

// 公开成果看板：无需登录
router.get('/stats', publicStats);
// 管理员统计：需登录且为管理员
router.get('/admin/stats', requireAuth, requireAdmin, adminStats);

export default router;
