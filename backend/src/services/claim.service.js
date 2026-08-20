import { randomUUID } from 'node:crypto';
import { readDb, updateDb } from '../db.js';
import { ITEM_STATUS, toClaimantItem, toPublicItem } from './item.service.js';

export async function createClaim({ itemId, claimantId, claimantName, note }) {
  const now = Date.now();
  const claim = {
    id: randomUUID(),
    itemId,
    claimantId: claimantId || 'anonymous',
    claimantName: claimantName || '匿名用户',
    note: note || '',
    status: 'PENDING',
    createdAt: now
  };

  await updateDb(async (db) => {
    const item = db.items.find((i) => i.id === itemId);
    if (!item) {
      throw Object.assign(new Error('失物不存在'), { status: 404 });
    }
    if (item.status !== ITEM_STATUS.OPEN) {
      throw Object.assign(new Error('该失物当前不可认领'), { status: 400 });
    }
    if (!Array.isArray(item.claims)) item.claims = [];
    item.claims.unshift(claim);
    item.status = ITEM_STATUS.CLAIMING;
    item.claimRequestedAt = item.claimRequestedAt || now;
    item.updatedAt = now;
    return db;
  });

  return claim;
}

/**
 * 认领审核：decision 为 'approve'（通过）或 'reject'（拒绝）
 * 权限：拾取人本人 或 管理员
 * 通过后：申请 APPROVED、物品 CLAIMED(已认领)（等待申请者确认领取），记录 claimantId/claimApprovedAt，
 *         其余 PENDING 申请自动关闭
 * 拒绝后：申请 REJECTED，若无其他活跃申请则物品回到 OPEN
 */
export async function reviewClaim({ claimId, decision, user }) {
  if (decision !== 'approve' && decision !== 'reject') {
    throw Object.assign(new Error('无效的审核操作'), { status: 400 });
  }
  let result = null;
  await updateDb(async (db) => {
    const item = db.items.find((i) => (i.claims || []).some((c) => c.id === claimId));
    if (!item) {
      throw Object.assign(new Error('认领申请不存在'), { status: 404 });
    }
    // 权限：拾取人本人 或 管理员
    const isOwner = user && item.pickerId === user.id;
    const isAdmin = user && user.role === 'admin';
    if (!isOwner && !isAdmin) {
      throw Object.assign(new Error('无权审核该认领申请'), { status: 403 });
    }
    const claim = item.claims.find((c) => c.id === claimId);
    if (!claim) {
      throw Object.assign(new Error('认领申请不存在'), { status: 404 });
    }
    if (claim.status !== 'PENDING') {
      throw Object.assign(new Error('该申请已处理，请勿重复操作'), { status: 400 });
    }

    const now = Date.now();
    if (decision === 'approve') {
      claim.status = 'APPROVED';
      item.status = ITEM_STATUS.CLAIMED; // 已认领（等待申请者领取）
      item.claimantId = claim.claimantId;
      item.claimApprovedAt = now;
      item.claims.forEach((c) => {
        if (c.id !== claimId && c.status === 'PENDING') c.status = 'REJECTED';
      });
    } else {
      claim.status = 'REJECTED';
      const hasActive = item.claims.some((c) => c.status === 'PENDING' || c.status === 'APPROVED');
      if (!hasActive) item.status = ITEM_STATUS.OPEN;
    }
    item.updatedAt = now;
    result = { item, claim };
    return db;
  });
  return result;
}

/**
 * 查询用户相关记录：
 * - pickedItems：用户作为拾取人发布的失物（发布者视图：含私有信息与认领申请）
 * - claimedItems：用户提交过认领的失物
 *   - 认领通过后：返回 公开信息 + 当前存放地点 + 详细地点（不含信息B/AI详细结果）
 *   - 未通过/待审核：仅公开信息
 */
export async function getUserRecords(userId) {
  const db = await readDb();
  const pickedItems = db.items
    .filter((i) => i.pickerId === userId)
    .map((i) => ({ ...i }));

  const claimedItems = db.items
    .filter((i) => (i.claims || []).some((c) => c.claimantId === userId))
    .map((i) => {
      const myClaim = i.claims.find((c) => c.claimantId === userId);
      const item = myClaim && myClaim.status === 'APPROVED' ? toClaimantItem(i) : toPublicItem(i);
      return { item, claim: myClaim };
    });

  return { pickedItems, claimedItems };
}

/** 管理员审核中心：返回所有含「待审核」认领的物品（管理员可见全部私有信息） */
export async function getPendingClaims() {
  const db = await readDb();
  const rows = db.items
    .map((i) => ({
      item: { ...toPublicItem(i), place: i.place, detailLocation: i.detailLocation, informationB: i.informationB },
      claims: (i.claims || []).filter((c) => c.status === 'PENDING')
    }))
    .filter((r) => r.claims.length > 0)
    .sort((a, b) => b.claims[0].createdAt - a.claims[0].createdAt);
  return rows;
}