/**
 * AI 服务统一错误码与错误类
 *
 * 所有视觉模型 Provider（智谱 GLM / DeepSeek V4 / 未来接入的其他模型）
 * 抛出错误时统一携带 code，便于上层做「限流不降级」等精确判断。
 */

export const AI_ERROR_CODES = {
  /** 限流（HTTP 429）：绝不静默降级 mock，直接返回友好错误 */
  RATE_LIMIT: 'AI_RATE_LIMIT',
  /** API Key 无效 / 无权限（HTTP 401 / 403） */
  AUTH: 'AI_AUTH',
  /** 服务端 5xx / 接口异常 */
  SERVER: 'AI_SERVER',
  /** 网络异常 / 超时 */
  NETWORK: 'AI_NETWORK',
  /** 模型输出无法解析为 JSON */
  PARSE: 'AI_PARSE',
  /** 模型未返回有效内容 */
  EMPTY: 'AI_EMPTY',
  /** 未配置 API Key */
  MISSING_KEY: 'AI_MISSING_KEY'
};

export class AiError extends Error {
  /**
   * @param {string} message 面向用户的友好错误信息
   * @param {string} [code] 错误码（AI_ERROR_CODES）
   * @param {number} [status] HTTP 状态码
   */
  constructor(message, code = AI_ERROR_CODES.SERVER, status = 500) {
    super(message);
    this.name = 'AiError';
    this.code = code;
    this.status = status;
  }
}

/** 是否为限流错误 */
export function isRateLimitError(err) {
  return Boolean(err && err.code === AI_ERROR_CODES.RATE_LIMIT);
}