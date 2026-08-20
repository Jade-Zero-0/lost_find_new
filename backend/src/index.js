import express from 'express';
import cors from 'cors';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { readDb } from './db.js';
import { getUploadDir } from './utils/image.js';
import { ensureSeedUsers } from './services/auth.service.js';
import { attachUser } from './middleware/auth.middleware.js';
import { accessLog } from './middleware/log.middleware.js';
import { errorHandler, notFound } from './middleware/error.middleware.js';
import authRoutes from './routes/auth.routes.js';
import itemRoutes from './routes/item.routes.js';
import claimRoutes from './routes/claim.routes.js';
import logRoutes from './routes/log.routes.js';
import aiRoutes from './routes/ai.routes.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 加载本地环境变量（backend/.env，仅开发/演示用；生产建议由 systemd/PM2/容器注入环境变量）
try {
  process.loadEnvFile(path.resolve(__dirname, '../.env'));
} catch {
  // 无 .env 文件时忽略
}

const app = express();

// ---- 生产环境配置（均可用环境变量覆盖）----
// 监听地址：0.0.0.0 允许公网访问（仅本机调试可改为 127.0.0.1）
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT) || 3001;

// 上传图片目录（默认 backend/uploads；生产可指定持久化路径）
const uploadDir = getUploadDir();
await fs.mkdir(uploadDir, { recursive: true });

// CORS：默认允许所有来源（公网 Demo 场景）；
// 生产可设置 CORS_ORIGIN=https://your-domain.com,https://www.xxx.com 限制来源
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
app.use(cors(corsOrigins.length ? { origin: corsOrigins, credentials: true } : {}));

// base64 图片体积较大，放宽 JSON 体积限制（默认 15mb，可用 JSON_BODY_LIMIT 调整）
const jsonLimit = process.env.JSON_BODY_LIMIT || '15mb';
app.use(express.json({ limit: jsonLimit }));
app.use(express.urlencoded({ extended: true, limit: jsonLimit }));

// 可选鉴权（挂载 req.user）+ 访问日志
// 确保演示账号存在（用户表为空时自动创建）
await ensureSeedUsers();

app.use(attachUser);
app.use(accessLog);

// 健康检查
app.get('/api/health', async (_req, res) => {
  try {
    const db = await readDb();
    const claims = db.items.reduce((sum, i) => sum + (i.claims ? i.claims.length : 0), 0);
    res.json({
      code: 0,
      data: {
        status: 'ok',
        service: 'ai-lost-found-backend',
        time: new Date().toISOString(),
        counts: { items: db.items.length, claims }
      },
      message: 'ok'
    });
  } catch (err) {
    res.status(500).json({ code: 1, data: null, message: '服务器内部错误' });
  }
});

// 业务路由
app.use('/api', authRoutes);
app.use('/api', itemRoutes);
app.use('/api', claimRoutes);
app.use('/api', logRoutes);
app.use('/api', aiRoutes);

// 静态资源：上传图片 + 前端构建产物（生产模式：先构建 frontend/dist）
app.use('/uploads', express.static(uploadDir));
const distDir = path.resolve(__dirname, '../../frontend/dist');
app.use(express.static(distDir));

// 404 与统一错误处理
app.use(notFound);
app.use(errorHandler);

const server = app.listen(PORT, HOST, () => {
  console.log(`[backend] AI寻物宝后端已启动: http://${HOST}:${PORT}`);
  console.log(`[backend] 健康检查: http://${HOST}:${PORT}/api/health`);
  console.log(`[backend] 上传目录: ${uploadDir}`);
  console.log(`[backend] 前端静态目录: ${distDir}`);
});

// 请求超时兜底：避免连接长时间挂起（AI 链路最长约 20s，120s 足够）
server.requestTimeout = 120000;

// 进程级异常兜底：不中断服务（生产建议配合 PM2/systemd 自动重启）
process.on('unhandledRejection', (reason) => {
  console.error('[backend] unhandledRejection:', reason);
});
process.on('uncaughtException', (err) => {
  console.error('[backend] uncaughtException:', err);
});