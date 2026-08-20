import { Router } from 'express';
import { loginCtrl, logoutCtrl, meCtrl, registerCtrl } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';
import { rateLimit } from '../middleware/rate-limit.middleware.js';

const router = Router();

// 登录/注册限流：每 IP 每分钟最多 10 次，缓解暴力破解与批量注册
const authLimiter = rateLimit({ windowMs: 60_000, max: 10, message: '操作过于频繁，请稍后再试' });

router.post('/auth/register', authLimiter, registerCtrl);
router.post('/auth/login', authLimiter, loginCtrl);
router.post('/auth/logout', logoutCtrl);
router.get('/auth/me', requireAuth, meCtrl);

export default router;