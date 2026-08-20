import { addLog } from '../services/log.service.js';

/** 记录所有 /api 请求（访问日志，稳妥的文件记录方案） */
export function accessLog(req, res, next) {
  const start = Date.now();
  res.on('finish', () => {
    void addLog({
      type: 'request',
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      ms: Date.now() - start,
      user: req.user ? req.user.username : null
    }).catch(() => {});
  });
  next();
}