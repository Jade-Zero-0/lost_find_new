/**
 * 轻量内存限流中间件（零依赖，适合单实例小型部署）
 *
 * 基于「固定时间窗 + 每 IP 计数」，用于给公开/敏感接口（登录、注册、埋点、上传）
 * 加一道基本防刷保护。注意：多实例部署时各进程计数独立，需要更强保护应改用
 * 集中式方案（如 Redis + express-rate-limit）。
 */
function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

export function rateLimit({ windowMs = 60_000, max = 30, message = '请求过于频繁，请稍后再试' } = {}) {
  /** @type {Map<string, { count: number, resetAt: number }>} */
  const hits = new Map();

  // 周期清理过期条目，避免 Map 无限增长
  const sweep = setInterval(() => {
    const now = Date.now();
    for (const [key, v] of hits) {
      if (v.resetAt <= now) hits.delete(key);
    }
  }, windowMs);
  if (typeof sweep.unref === 'function') sweep.unref();

  return function rateLimiter(req, res, next) {
    const key = clientIp(req);
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    if (entry.count > max) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      res.set('Retry-After', String(retryAfter));
      return res.status(429).json({ code: 1, data: null, message });
    }
    next();
  };
}
