/**
 * 前端环境配置（构建时由 Vite 注入，见 frontend/.env / .env.example）
 *
 * VITE_API_BASE_URL：
 *   - 留空（默认）：同源访问，适合「后端托管前端构建产物」的单服务部署；
 *   - 前后端分离时：填后端公网地址，例如 https://api.example.com（不要以 / 结尾）。
 */

/** 后端 API 基础地址（不含结尾斜杠） */
export function apiBase(): string {
  const base = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '';
  return base.replace(/\/+$/, '');
}

/** 前端请求超时（毫秒），默认 60s */
export function apiTimeoutMs(): number {
  const n = Number(import.meta.env.VITE_API_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 60000;
}