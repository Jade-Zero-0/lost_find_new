import { ok } from '../utils/response.js';
import { getConfig as getZhipuConfig } from '../services/glmVisionService.js';
import { getConfig as getQwenConfig } from '../services/qwenVisionService.js';
import { getConfig as getDeepseekConfig } from '../services/deepseekVisionService.js';
import { getActiveChain } from '../services/ai/ai.service.js';

/** GET /api/ai/status —— 当前 AI 配置状态（不返回 Key 本身） */
export function aiStatus(_req, res) {
  const qwen = getQwenConfig();
  const zhipu = getZhipuConfig();
  const deepseek = getDeepseekConfig();
  const provider = process.env.AI_PROVIDER || 'mock';
  // 复用 ai.service 的链路定义，避免与实际调用链路不一致
  const chain = getActiveChain();
  return ok(res, {
    provider,
    chain,
    qwen: {
      model: qwen.model,
      fallbackModel: qwen.fallbackModel,
      configured: Boolean(qwen.apiKey)
    },
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