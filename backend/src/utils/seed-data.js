import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { getDataDir } from './json-store.js';
import { getUploadDir } from './image.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 仓库内自带的种子数据目录（随代码一起部署，只读用途） */
function getSeedDir() {
  return path.resolve(__dirname, '../../../database');
}

/** 仓库内自带的种子图片目录（backend/uploads，随代码一起部署） */
function getSeedUploadDir() {
  return path.resolve(__dirname, '../../uploads');
}

/** 需要在持久盘首启时填充的初始数据文件 */
const SEED_FILES = [
  'lost_items.json',
  'users.json',
  'sessions.json',
  'access_logs.json'
];

/** 原子复制单个文件：写临时文件 + rename，避免复制一半被中断留下损坏文件 */
async function atomicCopy(source, targetDir, filename) {
  const raw = await fs.readFile(source);
  const tmp = path.join(targetDir, `.${filename}.${randomUUID().slice(0, 8)}.seed.tmp`);
  await fs.writeFile(tmp, raw);
  await fs.rename(tmp, path.join(targetDir, filename));
}

/**
 * 首次启动时填充种子数据：
 * 当 DATA_DIR 指向的持久盘为空（缺少某数据文件）时，
 * 从仓库自带的 database/ 与 backend/uploads/ 复制对应文件过去。
 * - 仅复制「目标不存在」的文件，绝不覆盖持久盘上的既有数据。
 * - 采用「写临时文件 + rename」原子复制。
 * - 当数据/上传目录就是种子目录本身（未配置持久盘）时直接跳过。
 */
export async function ensureSeedData() {
  await seedJsonFiles();
  await seedUploads();
}

/** 填充 JSON 数据文件到 DATA_DIR */
async function seedJsonFiles() {
  const dataDir = getDataDir();
  const seedDir = getSeedDir();
  if (path.resolve(dataDir) === path.resolve(seedDir)) return;

  await fs.mkdir(dataDir, { recursive: true });
  for (const filename of SEED_FILES) {
    const target = path.join(dataDir, filename);
    try {
      await fs.access(target);
      continue; // 已存在：保留持久盘上的数据，不覆盖
    } catch { /* 目标不存在，尝试复制 */ }

    const source = path.join(seedDir, filename);
    try {
      await fs.access(source);
    } catch {
      continue; // 种子文件不存在：交给 store 用默认空值兜底
    }
    await atomicCopy(source, dataDir, filename);
    console.log(`[seed] 已将种子数据 ${filename} 填充到持久盘 ${dataDir}`);
  }
}

/** 填充历史上传图片到持久盘的 uploads 目录 */
async function seedUploads() {
  const uploadDir = getUploadDir();
  const seedUploadDir = getSeedUploadDir();
  if (path.resolve(uploadDir) === path.resolve(seedUploadDir)) return;

  let entries;
  try {
    entries = await fs.readdir(seedUploadDir, { withFileTypes: true });
  } catch {
    return; // 无种子图片目录
  }

  await fs.mkdir(uploadDir, { recursive: true });
  let copied = 0;
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const target = path.join(uploadDir, entry.name);
    try {
      await fs.access(target);
      continue; // 已存在，不覆盖
    } catch { /* 目标不存在，复制 */ }
    await atomicCopy(path.join(seedUploadDir, entry.name), uploadDir, entry.name);
    copied++;
  }
  if (copied > 0) console.log(`[seed] 已将 ${copied} 张历史图片填充到 ${uploadDir}`);
}
