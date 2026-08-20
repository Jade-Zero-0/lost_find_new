import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware.js';
import { confirmReturn, getItemDetail, getLostItems, getMyItems, uploadItem } from '../controllers/item.controller.js';

const router = Router();

router.post('/upload', requireAuth, uploadItem);
router.get('/lost-items', getLostItems);
router.get('/items/:id', getItemDetail);
router.post('/items/:id/confirm-return', requireAuth, confirmReturn);
router.get('/my-items', requireAuth, getMyItems);

export default router;