import { randomUUID } from 'node:crypto';
import { readDb, updateDb } from '../db.js';
import { recognizeImage } from './ai/ai.service.js';

/**
 * 失物状态机：
 * OPEN(待认领) → CLAIMING(认领中) → CLAIMED(已认领) → RESOLVED(已归还)
 * CLAIMING →(拒绝)→ OPEN
 */
export const ITEM_STATUS = {
  OPEN: 'OPEN',        // 待认领
  CLAIMING: 'CLAIMING',// 认领中
  CLAIMED: 'CLAIMED',  // 已认领（认领通过，等待申请者领取）
  RESOLVED: 'RESOLVED' // 已归还（申请者确认已领取）
};

/** 公开字段：绝不包含任何私有信息（place/detailLocation/informationB/AI详细结果） */
const PUBLIC_FIELDS = [
  'id',
  'imageUrl',
  'type',
  'color',
  'description',   // 公开描述
  'locationTips',  // 地点Tips（公开）
  'status',
  'pickerName',
  'createdAt',
  'category',      // AI 公开标签（物品类别）
  'aiStatus'       // 仅用于前端「AI 分析中」提示，不含 AI 详细结果
];

/** 转换为对外公开的物品结构（普通用户可见；不含任何私有信息） */
export function toPublicItem(item) {
  const pub = {};
  for (const key of PUBLIC_FIELDS) {
    if (item[key] !== undefined) pub[key] = item[key];
  }
  // 兼容旧数据
  if (pub.aiStatus === undefined) {
    pub.aiStatus = item.aiTags && item.aiTags.type ? 'completed' : 'none';
  }
  if (!pub.category) pub.category = (item.aiTags && item.aiTags.type) || '';
  if (!pub.locationTips) pub.locationTips = '';
  if (!pub.status) pub.status = ITEM_STATUS.OPEN;
  pub.claimCount = Array.isArray(item.claims) ? item.claims.length : 0;
  return pub;
}

/** 发布者视图：可见全部信息（含私有地点、信息B、AI详细结果、认领申请） */
export function toOwnerItem(item) {
  return { ...item };
}

/**
 * 已通过认领的申请者视图：
 * 公开信息 + 当前存放地点(place) + 详细地点(detailLocation)
 * 不含：informationB、AI 详细结果（aiTags/shape/material/features/aiConfidence/aiError）
 */
export function toClaimantItem(item) {
  const pub = toPublicItem(item);
  if (item.place !== undefined) pub.place = item.place;
  if (item.detailLocation !== undefined) pub.detailLocation = item.detailLocation;
  return pub;
}

/** 创建失物记录（上传图片保存后调用；AI 结果可后补，见 updateItemAi） */
export async function createItem(data) {
  const now = Date.now();
  const ai = data.aiTags || {};
  const item = {
    id: randomUUID(),
    imageUrl: data.imageUrl || '',
    imageHash: data.imageHash || null,
    type: data.type || '其他',
    color: data.color || '未指定',
    description: data.description || '',
    // 本次升级新增字段
    locationTips: data.locationTips || '',     // 公开
    detailLocation: data.detailLocation || '', // 私有
    informationB: data.informationB || '',     // 私有（其他描述/验证信息）
    place: data.place || '',                   // 私有（当前失物存放地点，必填）
    pickerId: data.pickerId || 'anonymous',
    pickerName: data.pickerName || '匿名用户',
    status: ITEM_STATUS.OPEN,
    claims: [],
    // 认领闭环字段
    claimantId: data.claimantId || null,
    claimRequestedAt: data.claimRequestedAt || null,
    claimApprovedAt: data.claimApprovedAt || null,
    claimedAt: data.claimedAt || null,
    returnedAt: data.returnedAt || null,
    aiTags: data.aiTags || null,
    aiStatus: data.aiStatus || (ai.type ? 'completed' : 'none'),
    aiError: data.aiError || null,
    category: data.category ?? ai.type ?? '',
    shape: data.shape ?? ai.shape ?? '',
    material: data.material ?? ai.material ?? '',
    features: data.features ?? ai.feature ?? '',
    aiConfidence: data.aiConfidence ?? ai.confidence ?? null,
    createdAt: now,
    updatedAt: now
  };
  await updateDb(async (db) => {
    db.items.unshift(item);
    return db;
  });
  return item;
}

/** 按 id 查询物品（含未公开字段，仅内部/详情接口使用） */
export async function getItemById(id) {
  const db = await readDb();
  return db.items.find((i) => i.id === id) || null;
}

/**
 * 更新物品的 AI 识别状态与结果
 * aiStatus: 'processing' | 'completed' | 'failed'
 */
export async function updateItemAi(itemId, { aiStatus, aiTags, aiError } = {}) {
  await updateDb(async (db) => {
    const item = db.items.find((i) => i.id === itemId);
    if (!item) return db;
    if (aiStatus) item.aiStatus = aiStatus;
    if (aiError !== undefined) item.aiError = aiError || null;
    if (aiTags) {
      item.aiTags = aiTags;
      item.category = aiTags.type || item.category || '';
      item.shape = aiTags.shape || item.shape || '';
      item.material = aiTags.material || item.material || '';
      item.features = aiTags.feature || item.features || '';
      item.aiConfidence = aiTags.confidence ?? item.aiConfidence ?? null;
      if (!item.color || item.color === '未指定') item.color = aiTags.color || item.color;
    }
    item.updatedAt = Date.now();
    return db;
  });
  return getItemById(itemId);
}

/**
 * 后台自动 AI 分析（上传保存图片后调用，fire-and-forget）
 */
export async function runAiAnalysis(itemId, dataUrl) {
  try {
    const aiTags = await recognizeImage({ dataUrl });
    await updateItemAi(itemId, { aiStatus: 'completed', aiTags, aiError: null });
    console.log(`[ai] 物品 ${itemId} 识别完成`);
    return { aiStatus: 'completed', aiTags };
  } catch (err) {
    const message = (err && err.message) || 'AI 识别失败';
    await updateItemAi(itemId, { aiStatus: 'failed', aiError: message });
    console.warn(`[ai] 物品 ${itemId} 识别失败，已标记 aiStatus=failed：`, message);
    return { aiStatus: 'failed', aiError: message };
  }
}

/**
 * 申请者确认已领取失物：CLAIMED → RESOLVED
 * 权限：仅该失物「认领已通过」的申请者本人可调用
 */
export async function confirmItemReturn(itemId, userId) {
  let result = null;
  await updateDb(async (db) => {
    const item = db.items.find((i) => i.id === itemId);
    if (!item) {
      throw Object.assign(new Error('失物不存在'), { status: 404 });
    }
    if (item.status !== ITEM_STATUS.CLAIMED) {
      throw Object.assign(new Error('当前状态不允许确认领取（仅已认领的失物可确认）'), { status: 400 });
    }
    const approved = (item.claims || []).find(
      (c) => c.claimantId === userId && c.status === 'APPROVED'
    );
    if (!approved) {
      throw Object.assign(new Error('仅认领已通过的申请者可以确认领取'), { status: 403 });
    }
    const now = Date.now();
    item.status = ITEM_STATUS.RESOLVED;
    item.claimedAt = now;
    item.returnedAt = now;
    item.updatedAt = now;
    result = { item, claim: approved };
    return db;
  });
  return result;
}

/** 按图片内容哈希查找「仍在招领/认领中的重复图片」（用于去重） */
export async function findDuplicateImage(hash) {
  if (!hash) return null;
  const db = await readDb();
  return (
    db.items.find(
      (i) =>
        i.imageHash === hash &&
        (i.status === ITEM_STATUS.OPEN || i.status === ITEM_STATUS.CLAIMING || i.status === ITEM_STATUS.CLAIMED)
    ) || null
  );
}

export async function listItems({ type, status, keyword } = {}) {
  const db = await readDb();
  let items = db.items;
  if (status) {
    items = items.filter((i) => i.status === status);
  } else {
    // 公开列表默认展示 待认领/认领中/已认领；已归还(RESOLVED)/已下架(CLOSED) 从公共列表消失
    items = items.filter(
      (i) => i.status === ITEM_STATUS.OPEN || i.status === ITEM_STATUS.CLAIMING || i.status === ITEM_STATUS.CLAIMED
    );
  }
  if (type) items = items.filter((i) => i.type === type);
  if (keyword) {
    const kw = keyword.trim().toLowerCase();
    items = items.filter((i) => {
      // 服务端检索可包含内部字段（搜索结果仍是公开字段，不泄露私有信息）
      const text = [i.description, i.color, i.type, i.category, i.locationTips, i.shape, i.material, i.features]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return text.includes(kw);
    });
  }
  return items.map((i) => toPublicItem(i));
}