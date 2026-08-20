import { fail } from '../utils/response.js';

export function notFound(req, res) {
  return fail(res, 404, '接口不存在');
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);
  const status = typeof err.status === 'number' ? err.status : 500;

  // 请求体解析失败（express.json / urlencoded 抛错）：统一提示，不泄露细节
  if (err.type === 'entity.parse.failed' || err instanceof SyntaxError) {
    return fail(res, 400, '请求体格式错误');
  }
  // 请求体过大
  if (err.status === 413 || err.type === 'entity.too.large') {
    return fail(res, 413, '上传内容过大，请压缩图片后重试');
  }

  // 5xx：对外只返回通用文案，真实错误记录到服务端日志
  if (status >= 500) {
    console.error('[backend] error:', err);
    return fail(res, 500, '服务器内部错误，请稍后重试');
  }

  // 4xx 业务错误（如 400/403/404/409/429）：返回友好提示
  return fail(res, status, err.message || '请求失败');
}