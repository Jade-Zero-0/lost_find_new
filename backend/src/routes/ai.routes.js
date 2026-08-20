import { Router } from 'express';
import { aiStatus } from '../controllers/ai.controller.js';

const router = Router();

router.get('/ai/status', aiStatus);

export default router;