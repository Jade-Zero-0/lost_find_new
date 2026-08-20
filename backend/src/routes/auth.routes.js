import { Router } from 'express';
import { loginCtrl, logoutCtrl, meCtrl, registerCtrl } from '../controllers/auth.controller.js';
import { requireAuth } from '../middleware/auth.middleware.js';

const router = Router();

router.post('/auth/register', registerCtrl);
router.post('/auth/login', loginCtrl);
router.post('/auth/logout', logoutCtrl);
router.get('/auth/me', requireAuth, meCtrl);

export default router;