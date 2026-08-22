import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isR2Enabled, uploadToR2, deleteFromR2, checkR2Capacity, bumpR2Usage } from './r2-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 上传图片目录，优先级：
 * 1. UPLOAD_DIR 显式指定
 * 2. DATA_DIR/uploads（生产只需配一个 DATA_DIR，数据与图片同盘持久化）
 * 3. 开发默认 backend/uploads
 */
export function getUploadDir() {
  if (process.env.UPLOAD_DIR) return path.resolve(process.env.UPLOAD_DIR);
  if (process.env.DATA_DIR) return path.resolve(process.env.DATA_DIR, 'uploads');
  return path.resolve(__dirname, '../../uploads');
}

/** 单张图片大小上限（MB，默认 8；生产可通过 MAX_UPLOAD_MB 调整） */
function maxImageBytes() {
  const mb = Number(process.env.MAX_UPLOAD_MB);
  const n = Number.isFinite(mb) && mb > 0 ? mb : 8;
  return Math.round(n * 1024 * 1024);
}

const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i;
const EXT_MAP = { png: '.png', jpeg: '.jpg', jpg: '.jpg', webp: '.webp', gif: '.gif' };
const MIME_MAP = { png: 'image/png', jpeg: 'image/jpeg', jpg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

/**
 * 将前端传来的 base64 dataURL 解码并持久化保存。
 *
 * 存储位置二选一（自动判断）：
 * - 配齐 R2 环境变量时 → 上传到 Cloudflare R2，返回完整公网 URL（跨部署持久，永不丢图）；
 * - 未配置 R2 时 → 回退写本地 uploads 目录，返回 /uploads/xxx（本地开发/未接 R2 时可用）。
 *
 * 返回结构 { filename, url, hash } 保持稳定：
 * - filename 在 R2 模式下即对象 key，本地模式下为文件名，供后续删除使用；
 * - hash 为图片内容 SHA-256，用于去重与 AI 结果缓存。
 */
export async function saveBase64Image(dataUrl) {
  const match = DATA_URL_RE.exec((dataUrl || '').trim());
  if (!match) {
    throw Object.assign(new Error('图片数据格式不正确，请上传 JPG/PNG 等图片'), { status: 400 });
  }
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0) {
    throw Object.assign(new Error('图片内容为空'), { status: 400 });
  }
  const maxBytes = maxImageBytes();
  if (buffer.length > maxBytes) {
    throw Object.assign(new Error(`图片不能超过 ${Math.round(maxBytes / 1024 / 1024)}MB`), { status: 413 });
  }
  const kind = match[1].toLowerCase();
  const ext = EXT_MAP[kind] || '.jpg';
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  const hash = createHash('sha256').update(buffer).digest('hex');

  if (isR2Enabled()) {
    // 容量保护：超过 9GB 拒绝新上传，绝不产生任何费用
    const capacity = await checkR2Capacity();
    if (!capacity.ok) {
      throw Object.assign(
        new Error('图库存储已满（接近 9GB 上限），请联系管理员清理或扩容'),
        { status: 507 }
      );
    }
    // R2 模式：上传对象存储，url 为完整公网地址
    const url = await uploadToR2(filename, buffer, MIME_MAP[kind] || 'image/jpeg');
    bumpR2Usage(buffer.length); // 增量更新缓存
    return { filename, url, hash };
  }

  // 本地模式：写入 uploads 目录，url 为相对路径，由 express.static 暴露
  const uploadDir = getUploadDir();
  await fs.mkdir(uploadDir, { recursive: true });
  await fs.writeFile(path.join(uploadDir, filename), buffer);
  return { filename, url: `/uploads/${filename}`, hash };
}

/**
 * 删除已保存的上传图片（用于发布流程中断时清理孤儿文件，如 AI 限流）。
 * 按当前存储模式删除 R2 对象或本地文件；不存在或失败时静默忽略，不中断主流程。
 */
export async function deleteUploadedImage(filename) {
  if (!filename) return;
  if (isR2Enabled()) {
    await deleteFromR2(filename);
    return;
  }
  try {
    await fs.unlink(path.join(getUploadDir(), filename));
  } catch {
    // 文件可能已被清理或不存在，忽略
  }
}