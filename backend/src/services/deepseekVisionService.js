import { AiError, AI_ERROR_CODES } from './ai/ai-errors.js';
import { VISION_PROMPT, resolveImage, extractJson, normalizeVisionResult } from './ai/vision-utils.js';

const DEFAULT_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_MODEL = 'deepseek-v4-flash';

/**
 * DeepSeek V4 视觉识别服务（预留，默认不进入识别链路）
 *
 * ⚠️ 重要：据 DeepSeek 官方文档（api-docs.deepseek.com），DeepSeek V4 系列
 * （deepseek-v4-flash / deepseek-v4-pro）通过官方 API 是【纯文本模型】，不支持图片输入，
 * 传入 image_url 会返回 HTTP 400（InvalidParameter: image_url / Model do not support image input）。
 * 因此本项目默认不把 DeepSeek 作为视觉备用模型；视觉备用请用智谱 GLM-4V-Flash（见 ai.service.js）。
 * 本文件保留 analyzeLostItemImage() 接口与结构化解析，供未来 DeepSeek 开放识图能力后直接启用。
 *
 * - 端点：https://api.deepseek.com/chat/completions（/v1 亦可，见 DEEPSEEK_BASE_URL）
 * - 模型：deepseek-v4-flash / deepseek-v4-pro（均纯文本）
 * - 与智谱服务保持相同的 analyzeLostItemImage() 输入输出约定
 */

/** 集中读取环境变量（仅后端；生产环境由服务器注入） */
export function getConfig() {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: (process.env.DEEPSEEK_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    model: process.env.DEEPSEEK_MODEL || DEFAULT_MODEL,
    timeoutMs: Number(process.env.DEEPSEEK_TIMEOUT_MS) || Number(process.env.AI_TIMEOUT_MS) || 20000,
    deepThought: (process.env.DEEPSEEK_DEEP_THOUGHT || 'false').toLowerCase() === 'true'
  };
}

/** 单次请求 DeepSeek V4 接口并映射错误码 */
async function callDeepseek(cfg, dataUrl) {
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
        model: cfg.model,
        temperature: 0.1,
        max_tokens: 2048,
        stream: false,
        deep_thought: cfg.deepThought,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: VISION_PROMPT },
              { type: 'image_url', image_url: { url: dataUrl } }
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
    const snippet = String(bodyText || '').trim().slice(0, 200);
    const detail = snippet ? `：${snippet}` : '';
    if (res.status === 401 || res.status === 403) {
      throw new AiError('DeepSeek API Key 无效或无权限，请检查 DEEPSEEK_API_KEY 配置', AI_ERROR_CODES.AUTH, 502);
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
 * DeepSeek V4 视觉识别
 * @param {string|Buffer} image 图片路径 / Base64 / dataURL / Buffer
 * @returns {Promise<{category:string,color:string,shape:string,material:string,features:string,text:string,confidence:number|null}>}
 */
export async function analyzeLostItemImage(image) {
  const cfg = getConfig();
  if (!cfg.apiKey) {
    throw new AiError('未配置 DeepSeek DEEPSEEK_API_KEY，请在 backend/.env 或环境变量中设置', AI_ERROR_CODES.MISSING_KEY, 502);
  }
  const dataUrl = await resolveImage(image);
  return callDeepseek(cfg, dataUrl);
}