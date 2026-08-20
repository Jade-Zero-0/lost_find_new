import { AiError, AI_ERROR_CODES } from './ai/ai-errors.js';
import { VISION_PROMPT, resolveImage, extractJson, normalizeVisionResult, sleep } from './ai/vision-utils.js';

const DEFAULT_BASE_URL = 'https://open.bigmodel.cn/api/paas/v4';
const DEFAULT_MODEL = 'glm-4.6v-flash';

/**
 * 智谱 GLM-4.6V-Flash 视觉识别服务（第一优先模型）
 *
 * - 支持输入：图片路径 / 纯 Base64 / dataURL / Buffer
 * - 主模型 glm-4.6v-flash 默认只尝试 1 次（GLM_MAX_RETRIES=0），失败交由上层切换备用模型 glm-4.6v
 * - 如需 429 退避重试，可设置 GLM_MAX_RETRIES>0（重试次数）与 GLM_RETRY_DELAY_MS（间隔毫秒）
 * - API Key 从环境变量 GLM_API_KEY 读取（兼容旧变量 ZHIPU_API_KEY），绝不硬编码、绝不打印
 * - 失败抛出 AiError（携带 code），便于上层决定是否切换备用模型 / 是否降级 mock
 */

/** 解析非负整数配置：显式传入 0 时尊重 0，空/非法时用默认值 */
function parseNonNegativeInt(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

/** 日志脱敏：防止接口返回内容或异常信息中意外回显 API Key */
function redactSecret(text, secret) {
  if (!secret || !text) return String(text || '');
  return String(text).split(secret).join('[REDACTED]');
}

/** 集中读取环境变量（仅后端；生产环境由服务器注入）
 *  统一命名 GLM_*，同时兼容旧变量 ZHIPU_*（GLM_* 优先） */
export function getConfig() {
  return {
    // API Key 只从环境变量读取，绝不硬编码；GLM_API_KEY 优先，ZHIPU_API_KEY 兼容旧配置
    apiKey: process.env.GLM_API_KEY || process.env.ZHIPU_API_KEY || '',
    baseUrl: (process.env.GLM_BASE_URL || process.env.ZHIPU_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    model: process.env.GLM_MODEL || process.env.ZHIPU_MODEL || DEFAULT_MODEL,
    // 备用视觉模型（GLM-4.6V 高性能版：主模型 glm-4.6v-flash 超时/失败时的第二优先）
    fallbackModel: process.env.GLM_FALLBACK_MODEL || process.env.ZHIPU_FALLBACK_MODEL || 'glm-4.6v',
    timeoutMs: parseNonNegativeInt(
      process.env.GLM_TIMEOUT_MS,
      parseNonNegativeInt(process.env.ZHIPU_TIMEOUT_MS, parseNonNegativeInt(process.env.AI_TIMEOUT_MS, 15000))
    ),
    maxRetries: parseNonNegativeInt(process.env.GLM_MAX_RETRIES, parseNonNegativeInt(process.env.ZHIPU_MAX_RETRIES, 0)),
    retryDelayMs: parseNonNegativeInt(process.env.GLM_RETRY_DELAY_MS, parseNonNegativeInt(process.env.ZHIPU_RETRY_DELAY_MS, 2000))
  };
}

/** 单次请求智谱接口并映射错误码 */
async function callZhipu(cfg, dataUrl, model) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);
  let res;
  try {
    res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`
      },
      body: JSON.stringify({
        model,
        temperature: 0.3,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: dataUrl } },
              { type: 'text', text: VISION_PROMPT }
            ]
          }
        ]
      }),
      signal: controller.signal
    });
  } catch {
    throw new AiError('AI 视觉识别服务暂时不可用（网络异常或超时），请稍后重试', AI_ERROR_CODES.NETWORK, 502);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    const bodyText = await res.text().catch(() => '');
    const snippet = redactSecret(String(bodyText || '').trim(), cfg.apiKey).slice(0, 200);
    const detail = snippet ? `：${snippet}` : '';
    if (res.status === 401 || res.status === 403) {
      throw new AiError('智谱 API Key 无效或无权限，请检查 GLM_API_KEY 配置', AI_ERROR_CODES.AUTH, 502);
    }
    if (res.status === 429) {
      throw new AiError('AI 识别请求过于频繁，请稍后重试', AI_ERROR_CODES.RATE_LIMIT, 429);
    }
    if (res.status >= 500) {
      throw new AiError(`AI 识别服务暂时不可用（HTTP ${res.status}）${detail}`, AI_ERROR_CODES.SERVER, 502);
    }
    throw new AiError(`AI 识别接口返回异常（HTTP ${res.status}）${detail}`, AI_ERROR_CODES.SERVER, 502);
  }

  let data;
  try {
    data = await res.json();
  } catch {
    throw new AiError('AI 识别服务返回格式异常，请稍后重试', AI_ERROR_CODES.PARSE, 502);
  }

  const content = data?.choices?.[0]?.message?.content;
  if (!content) {
    throw new AiError('AI 识别未返回有效内容，请稍后重试', AI_ERROR_CODES.EMPTY, 502);
  }

  let raw;
  try {
    raw = extractJson(content);
  } catch {
    throw new AiError('AI 识别结果解析失败，请重试', AI_ERROR_CODES.PARSE, 502);
  }

  return normalizeVisionResult(raw);
}

/**
 * 智谱 GLM 视觉识别（默认只尝试 1 次；可配置 429 退避重试）
 * @param {string|Buffer} image 图片路径 / Base64 / dataURL / Buffer
 * @returns {Promise<{category:string,color:string,shape:string,material:string,features:string,text:string,confidence:number|null}>}
 */
export async function analyzeLostItemImage(image, { model, maxRetries } = {}) {
  const cfg = getConfig();
  if (!cfg.apiKey) {
    throw new AiError('未配置 GLM_API_KEY（兼容旧变量 ZHIPU_API_KEY），请在 backend/.env 或环境变量中设置', AI_ERROR_CODES.MISSING_KEY, 502);
  }

  const targetModel = model || cfg.model;
  // maxRetries 允许按调用方覆盖（如备用模型只尝试 1 次）
  const targetRetries = Number.isFinite(Number(maxRetries)) ? Math.max(0, Number(maxRetries)) : cfg.maxRetries;
  const dataUrl = await resolveImage(image);
  // 默认只尝试 1 次（targetRetries=0）；备用模型同样传 maxRetries=0 只尝试 1 次
  const maxAttempts = Math.max(1, targetRetries + 1);
  let lastErr;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await callZhipu(cfg, dataUrl, targetModel);
    } catch (err) {
      lastErr = err;
      const isRateLimit = err.code === AI_ERROR_CODES.RATE_LIMIT;
      if (attempt < maxAttempts && isRateLimit) {
        console.warn(`[ai] zhipu 触发限流(429)，${cfg.retryDelayMs}ms 后进行第 ${attempt + 1} 次重试`);
        await sleep(cfg.retryDelayMs);
        continue;
      }
      break;
    }
  }
  throw lastErr;
}