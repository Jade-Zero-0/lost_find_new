import * as MockAIProvider from './providers/mock.provider.js';
import * as OpenAIProvider from './providers/openai.provider.js';
import { analyzeLostItemImage as analyzeWithZhipu, getConfig as getZhipuConfig } from '../glmVisionService.js';
import { analyzeLostItemImage as analyzeWithDeepseek, getConfig as getDeepseekConfig } from '../deepseekVisionService.js';
import { AiError, AI_ERROR_CODES } from './ai-errors.js';

/** 将视觉服务返回的 7 字段结果映射为统一的 aiTags 结构 */
function toAiTags(result, provider, model) {
  return {
    type: result.category,
    color: result.color,
    shape: result.shape,
    feature: result.features,
    material: result.material,
    text: result.text,
    confidence: result.confidence,
    provider,
    model
  };
}

/** 智谱 GLM-4.6V-Flash Provider（第一优先） */
const ZhipuProvider = {
  name: 'zhipu',
  isConfigured: () => Boolean(getZhipuConfig().apiKey),
  async recognize(input) {
    const result = await analyzeWithZhipu(input.dataUrl || input.imagePath || input.imageBuffer);
    return toAiTags(result, 'zhipu', getZhipuConfig().model);
  }
};

/** 智谱备用视觉模型 Provider（glm-4.6v 高性能版）：只尝试 1 次 */
const ZhipuFallbackProvider = {
  name: 'zhipu-fallback',
  isConfigured: () => Boolean(getZhipuConfig().apiKey),
  async recognize(input) {
    const cfg = getZhipuConfig();
    const result = await analyzeWithZhipu(input.dataUrl || input.imagePath || input.imageBuffer, {
      model: cfg.fallbackModel,
      maxRetries: 0
    });
    return toAiTags(result, 'zhipu-fallback', cfg.fallbackModel);
  }
};

/**
 * DeepSeek V4 Provider（预留，默认不进入识别链路）
 * ⚠️ DeepSeek 官方 API 为纯文本模型，不支持图片输入；仅当 AI_PROVIDER=deepseek
 * 显式指定时才尝试（预期会返回图片不支持的 400 错误），未来开放识图能力后可直接启用。
 */
const DeepSeekProvider = {
  name: 'deepseek',
  isConfigured: () => Boolean(getDeepseekConfig().apiKey),
  async recognize(input) {
    const result = await analyzeWithDeepseek(input.dataUrl || input.imagePath || input.imageBuffer);
    return toAiTags(result, 'deepseek', getDeepseekConfig().model);
  }
};

/**
 * Provider 注册表：key 与 AI_PROVIDER / 链路名对应
 * 未来接入其他视觉模型时，只需在此注册并实现相同的 recognize 接口
 */
const PROVIDERS = {
  mock: MockAIProvider,
  zhipu: ZhipuProvider,
  'zhipu-fallback': ZhipuFallbackProvider,
  deepseek: DeepSeekProvider,
  openai: OpenAIProvider
};

/**
 * AI 调用链路：
 * - mock          → 仅离线模拟
 * - zhipu / auto  → 智谱 GLM-4.6V-Flash（只尝试 1 次）
 *                   → 失败（含超时/限流）切智谱 GLM-4.6V（备用，只尝试 1 次）
 * - deepseek      → 仅 DeepSeek V4（官方 API 纯文本，不支持识图，仅预留）
 */
const CHAINS = {
  mock: ['mock'],
  zhipu: ['zhipu', 'zhipu-fallback'],
  auto: ['zhipu', 'zhipu-fallback'],
  deepseek: ['deepseek'],
  openai: ['openai']
};

function resolveChain() {
  const name = (process.env.AI_PROVIDER || 'mock').toLowerCase();
  const chain = CHAINS[name];
  if (!chain) {
    console.warn(`[ai] 未知的 AI_PROVIDER="${name}"，已回退到 mock`);
    return ['mock'];
  }
  return chain;
}

/**
 * AIService 统一入口：输入图片，输出识别标签
 *
 * 规则：
 * 1. 按 AI_PROVIDER 决定调用链路（GLM-4.6V-Flash 只尝试 1 次 → 备用 GLM-4.6V 只尝试 1 次）
 * 2. 主/备用模型默认都只尝试 1 次（ZHIPU_MAX_RETRIES 默认 0；设为 >0 可开启 429 退避重试）
 * 3. 未配置 API Key 的 Provider 自动跳过（不产生失败日志）
 * 4. 整条链路都失败时：
 *    - 若最后错误是限流(429) → 绝不降级 mock，直接抛出
 *      「AI 识别请求过于频繁，请稍后重试」
 *    - 其他异常 → AI_FALLBACK_TO_MOCK=true（默认）时用 mock 兜底，保证演示不中断
 *
 * @param {{ dataUrl?: string, imagePath?: string, imageBuffer?: Buffer }} input
 * @returns {Promise<{ type: string, color: string, shape: string, feature: string, material?: string, text?: string, confidence?: number|null, provider: string, model: string }>}
 */
export async function recognizeImage(input) {
  const chain = resolveChain();
  if (chain.length === 1 && chain[0] === 'mock') {
    const mock = await MockAIProvider.recognize(input);
    return { ...mock, provider: 'mock', model: 'mock' };
  }

  const fallbackToMock = process.env.AI_FALLBACK_TO_MOCK !== 'false';
  let lastErr = null;

  for (const name of chain) {
    const provider = PROVIDERS[name];
    if (!provider) continue;
    if (typeof provider.isConfigured === 'function' && !provider.isConfigured()) {
      console.warn(`[ai] ${name} 未配置 API Key，跳过该模型`);
      continue;
    }
    try {
      const tags = await provider.recognize(input);
      return { ...tags, provider: tags.provider || name, model: tags.model || name };
    } catch (err) {
      lastErr = err;
      console.warn(`[ai] ${name} 识别失败：${err.message}`);
    }
  }

  // 整条链路均失败（或全部因未配置 Key 被跳过）
  if (!lastErr) {
    throw new AiError(
      '未配置任何可用的 AI 模型 API Key（请检查 GLM_API_KEY / DEEPSEEK_API_KEY）',
      AI_ERROR_CODES.MISSING_KEY,
      502
    );
  }
  // 限流：绝不静默降级 mock，直接返回友好错误
  if (lastErr.code === AI_ERROR_CODES.RATE_LIMIT) {
    throw new AiError('AI 识别请求过于频繁，请稍后重试', AI_ERROR_CODES.RATE_LIMIT, 429);
  }
  if (fallbackToMock) {
    console.warn(`[ai] ${chain.join(' → ')} 全部失败，已降级到 mock：${lastErr?.message}`);
    const mock = await MockAIProvider.recognize(input);
    return { ...mock, provider: 'mock', model: 'mock' };
  }
  throw lastErr;
}