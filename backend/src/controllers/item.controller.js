import { fail, ok } from '../utils/response.js';
import { saveBase64Image, deleteUploadedImage } from '../utils/image.js';
import {
  confirmItemReturn,
  createItem,
  findDuplicateImage,
  getItemById,
  listItems,
  runAiAnalysis,
  toClaimantItem,
  toOwnerItem,
  toPublicItem
} from '../services/item.service.js';
import { getUserRecords } from '../services/claim.service.js';

/**
 * POST /api/upload —— 发布失物（需登录）
 * 必填：图片、当前失物存放地点(place)、物品描述
 * 选填：地点Tips(locationTips,公开)、详细地点(detailLocation,私有)、其他描述(informationB,私有)、类型、颜色
 * 流程：校验 → 保存图片 → 图片去重 → 创建记录(aiStatus=processing) → 后台自动 AI 分析 → 返回
 */
export async function uploadItem(req, res, next) {
  try {
    const image = (req.body.image || '').trim();
    const place = (req.body.place || '').trim();
    const description = (req.body.description || '').trim();
    const locationTips = (req.body.locationTips || '').trim();
    const detailLocation = (req.body.detailLocation || '').trim();
    const informationB = (req.body.informationB || '').trim();

    if (!image) return fail(res, 400, '请上传物品图片');
    if (!place) return fail(res, 400, '请填写当前失物存放地点');
    if (!description) return fail(res, 400, '请填写物品描述');

    // 1. 保存图片
    const { url, hash, filename } = await saveBase64Image(image);

    // 2. 图片内容去重
    const dup = await findDuplicateImage(hash);
    if (dup) {
      await deleteUploadedImage(filename);
      return fail(res, 409, `该图片已登记过（${dup.type} · ${(dup.description || '').slice(0, 20)}），请勿重复发布`);
    }

    // 3. 创建记录
    const item = await createItem({
      imageUrl: url,
      imageHash: hash,
      place,
      description,
      locationTips,
      detailLocation,
      informationB,
      type: (req.body.type || '').trim() || '其他',
      color: (req.body.color || '').trim() || '未指定',
      pickerId: req.user.id,
      pickerName: req.user.displayName,
      aiStatus: 'processing'
    });

    // 4. 自动触发 AI 分析（后台异步；失败不中断）
    runAiAnalysis(item.id, image).catch((err) => {
      console.warn('[ai] 后台 AI 分析任务异常:', err && err.message ? err.message : err);
    });

    // 5. 返回发布者视图（发布者可见全部信息）
    return ok(res, { item: toOwnerItem(item) });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/lost-items —— 公开失物列表（仅公开字段） */
export async function getLostItems(req, res, next) {
  try {
    const items = await listItems({
      type: req.query.type,
      status: req.query.status,
      keyword: req.query.keyword
    });
    return ok(res, { items });
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/items/:id —— 物品详情（按登录身份返回不同字段）
 * 普通用户：仅公开字段
 * 发布者：全部字段（含私有地点、信息B、AI详细结果、认领申请）
 * 认领已通过的申请者：公开 + 当前存放地点 + 详细地点
 */
export async function getItemDetail(req, res, next) {
  try {
    const item = await getItemById(req.params.id);
    if (!item) return fail(res, 404, '物品不存在');
    const user = req.user;
    if (user && item.pickerId === user.id) {
      return ok(res, { item: toOwnerItem(item) });
    }
    const approvedClaim = (item.claims || []).find(
      (c) => user && c.claimantId === user.id && c.status === 'APPROVED'
    );
    if (approvedClaim) {
      return ok(res, { item: toClaimantItem(item) });
    }
    return ok(res, { item: toPublicItem(item) });
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/items/:id/confirm-return —— 申请者确认已领取（需登录）
 * 权限：仅该失物认领已通过的申请者本人；状态由 CLAIMED(已认领) → RESOLVED(已归还)
 */
export async function confirmReturn(req, res, next) {
  try {
    const { item, claim } = await confirmItemReturn(req.params.id, req.user.id);
    return ok(res, { item: toClaimantItem(item), claim });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/my-items —— 当前登录用户的相关记录 */
export async function getMyItems(req, res, next) {
  try {
    const result = await getUserRecords(req.user.id);
    return ok(res, result);
  } catch (err) {
    return next(err);
  }
}