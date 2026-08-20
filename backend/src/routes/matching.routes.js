import { Router } from 'express';
import { searchMatch } from '../controllers/matching.controller.js';
import { rateLimit } from '../middleware/rate-limit.middleware.js';

const router = Router();

// 扫图找失物：可匿名（匹配结果均为公开数据）。
// 每 IP 每分钟最多 10 次，防止图片识别接口被刷（AI 调用有成本/限流）。
router.post(
  '/matching/search',
  rateLimit({ windowMs: 60_000, max: 10, message: '操作太频繁，请稍后再试' }),
  searchMatch
);

export default router;
