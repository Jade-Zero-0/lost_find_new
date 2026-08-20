import { promises as fs } from 'node:fs';
import { readDb, usersStore } from '../db.js';
import { getUploadDir } from '../utils/image.js';

/**
 * 平台数据看板统计
 * - 公开统计实时从失物数据计算，不落盘、不新增数据表
 * - 状态枚举与 item.service.js 的 ITEM_STATUS 保持一致（OPEN/CLAIMING/CLAIMED/RESOLVED）
 */

/** 公开统计：累计发布 / 各状态计数 / 找回率 / 近7天发布趋势 / 高频拾取地点 Top5 */
export async function getPublicStats() {
  const db = await readDb();
  const items = db.items;
  const totals = {
    published: items.length,
    open: items.filter((i) => i.status === 'OPEN').length,
    claiming: items.filter((i) => i.status === 'CLAIMING').length,
    claimed: items.filter((i) => i.status === 'CLAIMED').length,
    returned: items.filter((i) => i.status === 'RESOLVED').length
  };
  const returnRate = totals.published > 0 ? Math.round((totals.returned / totals.published) * 100) : 0;

  // 近 7 天每天新增发布数
  const trend7 = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const start = d.getTime();
    const end = start + 24 * 3600 * 1000;
    trend7.push({
      date: `${d.getMonth() + 1}-${d.getDate()}`,
      count: items.filter((it) => it.createdAt >= start && it.createdAt < end).length
    });
  }

  // 地点Tips Top5（高频拾取地点）
  const map = {};
  for (const it of items) {
    const t = (it.locationTips || '').trim();
    if (t) map[t] = (map[t] || 0) + 1;
  }
  const topTips = Object.entries(map)
    .map(([location, count]) => ({ location, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return { totals, returnRate, trend7, topTips };
}

/** 管理员统计：公开统计 + 用户数 / 上传图片数 / 认领申请总数 */
export async function getAdminStats() {
  const [pub, usersDb, db] = await Promise.all([getPublicStats(), usersStore.read(), readDb()]);
  let uploadCount = 0;
  try {
    const files = await fs.readdir(getUploadDir());
    uploadCount = files.filter((f) => !/^seed-/.test(f)).length;
  } catch {
    // 目录不存在时按 0 处理
  }
  const claimTotal = db.items.reduce((sum, i) => sum + (Array.isArray(i.claims) ? i.claims.length : 0), 0);
  return { ...pub, users: usersDb.users.length, uploadCount, claimTotal };
}
