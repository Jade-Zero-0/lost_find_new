import { Router } from 'express';
import { adminLogs, logVisit } from '../controllers/log.controller.js';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/log/visit', logVisit);
router.get('/admin/logs', requireAuth, requireAdmin, adminLogs);

export default router;