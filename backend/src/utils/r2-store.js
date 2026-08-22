import { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

/**
 * Cloudflare R2 对象存储封装（S3 兼容 API）。
 *
 * 用途：将用户上传的图片存到 R2，实现跨部署/重启的持久化，
 * 解决 Render 免费版容器无持久盘、重启丢图的问题。
 *
 * 需要的环境变量（在 Render 面板以 sync:false 手填敏感项）：
 * - R2_ACCOUNT_ID        Cloudflare 账号 ID
 * - R2_ACCESS_KEY_ID     R2 API 令牌的 Access Key ID
 * - R2_SECRET_ACCESS_KEY R2 API 令牌的 Secret Access Key
 * - R2_BUCKET            存储桶名称
 * - R2_PUBLIC_URL        桶的公开访问地址（r2.dev 域或自定义域，如 https://img.example.com）
 * - R2_ENDPOINT          可选，S3 端点，默认 https://<account>.r2.cloudflarestorage.com
 *
 * 未配置齐全时 isR2Enabled() 返回 false，上层自动回退到本地文件存储。
 */

export function getR2Config() {
  return {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucket: process.env.R2_BUCKET || '',
    // 去掉末尾斜杠，便于拼接
    publicUrl: (process.env.R2_PUBLIC_URL || '').replace(/\/+$/, ''),
    endpoint: (process.env.R2_ENDPOINT || '').replace(/\/+$/, '')
  };
}

/** 是否已配置齐全 R2（缺任一必填项即视为未启用，回退本地存储） */
export function isR2Enabled() {
  const c = getR2Config();
  return Boolean(c.accessKeyId && c.secretAccessKey && c.bucket && c.publicUrl && (c.endpoint || c.accountId));
}

let client = null;

/** 惰性创建 S3 客户端（R2 endpoint 固定 auto 区域） */
function getClient() {
  if (client) return client;
  const c = getR2Config();
  const endpoint = c.endpoint || `https://${c.accountId}.r2.cloudflarestorage.com`;
  client = new S3Client({
    region: 'auto',
    endpoint,
    credentials: {
      accessKeyId: c.accessKeyId,
      secretAccessKey: c.secretAccessKey
    }
  });
  return client;
}

/**
 * 上传对象到 R2。
 * @param {string} key 对象键（即文件名）
 * @param {Buffer} buffer 文件内容
 * @param {string} contentType MIME 类型
 * @returns {Promise<string>} 公开访问 URL
 */
export async function uploadToR2(key, buffer, contentType) {
  const c = getR2Config();
  await getClient().send(
    new PutObjectCommand({
      Bucket: c.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      // 一年强缓存，图片内容不可变（文件名带时间戳+随机串）
      CacheControl: 'public, max-age=31536000, immutable'
    })
  );
  return `${c.publicUrl}/${key}`;
}

/** 从 R2 删除对象；失败静默忽略，不中断主流程 */
export async function deleteFromR2(key) {
  if (!key) return;
  const c = getR2Config();
  try {
    await getClient().send(new DeleteObjectCommand({ Bucket: c.bucket, Key: key }));
  } catch {
    // 对象可能不存在或删除失败，忽略
  }
}

/* ─── 容量保护 ────────────────────────────────────────────
 * 免费额度 10GB，设 9GB 为硬上限。
 * 超过即拒绝新上传，绝对不产生任何费用。
 * 使用量通过 ListObjectsV2 遍历累加，结果缓存 5 分钟。
 * ──────────────────────────────────────────────────────── */

const CAPACITY_LIMIT_BYTES = 9 * 1024 * 1024 * 1024; // 9 GB
const USAGE_CACHE_TTL_MS = 5 * 60 * 1000; // 5 分钟

let usageCache = { size: 0, expiresAt: 0 };

/**
 * 查询 R2 桶当前已用容量（字节）。结果缓存 5 分钟避免频繁请求。
 */
export async function getR2Usage() {
  const now = Date.now();
  if (usageCache.expiresAt > now) return usageCache.size;

  const c = getR2Config();
  const client = getClient();
  let totalSize = 0;
  let continuationToken;

  do {
    const resp = await client.send(
      new ListObjectsV2Command({
        Bucket: c.bucket,
        ContinuationToken: continuationToken,
        MaxKeys: 1000
      })
    );
    for (const obj of resp.Contents || []) {
      totalSize += obj.Size || 0;
    }
    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuationToken);

  usageCache = { size: totalSize, expiresAt: now + USAGE_CACHE_TTL_MS };
  return totalSize;
}

/**
 * 检查是否还有可用容量。
 * @returns {{ ok: boolean, used: number, limit: number }}
 */
export async function checkR2Capacity() {
  const used = await getR2Usage();
  return { ok: used < CAPACITY_LIMIT_BYTES, used, limit: CAPACITY_LIMIT_BYTES };
}

/** 上传成功后更新本地缓存（增量，无需等待缓存过期） */
export function bumpR2Usage(bytes) {
  usageCache.size += bytes;
}
