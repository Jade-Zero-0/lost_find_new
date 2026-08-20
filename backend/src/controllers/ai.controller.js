import { ok } from '../utils/response.js';
import { getConfig as getZhipuConfig } from '../services/glmVisionService.js';
import { getConfig as getDeepseekConfig } from '../services/deepseekVisionService.js';

/** GET /api/ai/status —— 当前 AI 配置状态（不返回 Key 本身） */
export function aiStatus(_req, res) {
  const zhipu = getZhipuConfig();
  const deepseek = getDeepseekConfig();
  const provider = process.env.AI_PROVIDER || 'mock';
  const chain =
    provider === 'zhipu' || provider === 'auto' ? ['zhipu', 'zhipu-fallback'] : [provider];
  return ok(res, {
    provider,
    chain,
    zhipu: {
      model: zhipu.model,
      fallbackModel: zhipu.fallbackModel,
      configured: Boolean(zhipu.apiKey)
    },
    // DeepSeek 官方 API 纯文本，暂不支持识图，仅作预留展示
    deepseek: { model: deepseek.model, configured: Boolean(deepseek.apiKey), note: 'text-only, no vision' },
    fallbackToMock: process.env.AI_FALLBACK_TO_MOCK !== 'false'
  });
}