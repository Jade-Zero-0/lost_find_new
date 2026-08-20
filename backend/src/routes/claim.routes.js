import { Router } from 'express';
import { requireAdmin, requireAuth } from '../middleware/auth.middleware.js';
import { addClaim, adminPendingClaims, approveClaim, rejectClaim } from '../controllers/claim.controller.js';

const router = Router();

router.post('/claim', requireAuth, addClaim);
router.get('/admin/pending-claims', requireAuth, requireAdmin, adminPendingClaims);
router.post('/claims/:claimId/approve', requireAuth, approveClaim);
router.post('/claims/:claimId/reject', requireAuth, rejectClaim);

export default router;