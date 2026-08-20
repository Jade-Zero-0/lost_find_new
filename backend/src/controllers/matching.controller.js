import { fail, ok } from '../utils/response.js';
import { AI_ERROR_CODES } from '../services/ai/ai-errors.js';
import { searchMatchingLostItems } from '../services/matching.service.js';

/**
 * POST /api/matching/search —— 失主扫图找失物（可匿名；仅返回公开字段）
 * 流程：校验图片 → AI 特征提取（recognizeImage 内部完成解析/校验）→ 公开失物结构化匹配 → 评分排序 → 返回候选
 * 隐私：候选 item 仅为公开字段，绝不含 place/detailLocation/informationB。
 * 防刷：由路由层 rateLimit 中间件保护。
 */
export async function searchMatch(req, res, next) {
  try {
    const image = (req.body.image || '').trim();
    if (!image) return fail(res, 400, '请上传物品图片');

    const { query, candidates } = await searchMatchingLostItems({ dataUrl: image });
    return ok(res, { query, count: candidates.length, candidates });
  } catch (err) {
    // AI 侧错误转为友好提示，其余交给统一错误处理
    if (err && err.code === AI_ERROR_CODES.RATE_LIMIT) {
      return fail(res, 429, 'AI 识别请求过于频繁，请稍后重试');
    }
    if (err && err.code === AI_ERROR_CODES.MISSING_KEY) {
      return fail(res, 502, 'AI 识别服务未配置，暂时无法使用识图找失物');
    }
    return next(err);
  }
}
