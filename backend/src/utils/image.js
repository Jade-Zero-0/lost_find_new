import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 上传图片目录：默认 backend/uploads；
 * 生产环境可通过环境变量 UPLOAD_DIR 指定持久化磁盘路径（如 /data/ai-lost-found/uploads）
 */
export function getUploadDir() {
  return process.env.UPLOAD_DIR ? path.resolve(process.env.UPLOAD_DIR) : path.resolve(__dirname, '../../uploads');
}

/** 单张图片大小上限（MB，默认 8；生产可通过 MAX_UPLOAD_MB 调整） */
function maxImageBytes() {
  const mb = Number(process.env.MAX_UPLOAD_MB);
  const n = Number.isFinite(mb) && mb > 0 ? mb : 8;
  return Math.round(n * 1024 * 1024);
}

const DATA_URL_RE = /^data:image\/(png|jpe?g|webp|gif);base64,(.+)$/i;
const EXT_MAP = { png: '.png', jpeg: '.jpg', jpg: '.jpg', webp: '.webp', gif: '.gif' };

/**
 * 将前端传来的 base64 dataURL 解码并保存为图片文件
 * 返回 { filename, url, hash }，hash 为图片内容 SHA-256，用于去重
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
  const uploadDir = getUploadDir();
  await fs.mkdir(uploadDir, { recursive: true });
  const ext = EXT_MAP[match[1].toLowerCase()] || '.jpg';
  const filename = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`;
  await fs.writeFile(path.join(uploadDir, filename), buffer);
  const hash = createHash('sha256').update(buffer).digest('hex');
  return { filename, url: `/uploads/${filename}`, hash };
}

/**
 * 删除已保存的上传图片（用于发布流程中断时清理孤儿文件，如 AI 限流）
 * 文件不存在或删除失败时静默忽略，不中断主流程
 */
export async function deleteUploadedImage(filename) {
  if (!filename) return;
  try {
    await fs.unlink(path.join(getUploadDir(), filename));
  } catch {
    // 文件可能已被清理或不存在，忽略
  }
}