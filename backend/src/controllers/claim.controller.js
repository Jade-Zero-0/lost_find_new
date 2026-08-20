import { fail, ok } from '../utils/response.js';
import { createClaim, getPendingClaims, reviewClaim } from '../services/claim.service.js';
import { toPublicItem } from '../services/item.service.js';

/** POST /api/claim —— 当前登录用户申请认领 */
export async function addClaim(req, res, next) {
  try {
    const itemId = (req.body.itemId || '').trim();
    if (!itemId) return fail(res, 400, '缺少 itemId');

    const claim = await createClaim({
      itemId,
      claimantId: req.user.id,
      claimantName: req.user.displayName,
      note: (req.body.note || '').trim()
    });
    return ok(res, { claim });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/claims/:claimId/approve —— 通过认领（拾取人或管理员） */
export async function approveClaim(req, res, next) {
  try {
    const { claimId } = req.params;
    if (!claimId) return fail(res, 400, '缺少 claimId');
    const { item, claim } = await reviewClaim({ claimId, decision: 'approve', user: req.user });
    return ok(res, { item: toPublicItem(item), claim });
  } catch (err) {
    return next(err);
  }
}

/** POST /api/claims/:claimId/reject —— 拒绝认领（拾取人或管理员） */
export async function rejectClaim(req, res, next) {
  try {
    const { claimId } = req.params;
    if (!claimId) return fail(res, 400, '缺少 claimId');
    const { item, claim } = await reviewClaim({ claimId, decision: 'reject', user: req.user });
    return ok(res, { item: toPublicItem(item), claim });
  } catch (err) {
    return next(err);
  }
}

/** GET /api/admin/pending-claims —— 管理员查看所有待审核认领 */
export async function adminPendingClaims(req, res, next) {
  try {
    const items = await getPendingClaims();
    return ok(res, { items });
  } catch (err) {
    return next(err);
  }
}