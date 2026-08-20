import { useCallback, useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState';
import { Spinner } from '../components/LoadingSpinner';
import SkeletonCard from '../components/SkeletonCard';
import { useToast } from '../components/Toast';
import Modal from '../components/Modal';
import StatusTimeline from '../components/StatusTimeline';
import { api, type ClaimInfo, type ClaimedRow, type PendingClaimItem, type PickedItem } from '../lib/api';
import { colorHex, timeAgo } from '../lib/format';
import { imageSrc } from '../lib/image';
import { Link } from '../lib/router';
import { getCurrentUser, isAdmin } from '../lib/user';
import type { ClaimStatus } from '../types';

const CANCEL_REASONS = ['认错了，不是我的物品', '已经找到了', '暂时不需要', '其他原因'];

const BASE_TABS = [
  { key: 'posts', label: '我的发布', icon: '📤' },
  { key: 'claims', label: '我的认领', icon: '🤝' }
] as const;

const REVIEW_TAB = { key: 'review', label: '审核中心', icon: '🛡️' } as const;

type TabKey = (typeof BASE_TABS)[number]['key'] | (typeof REVIEW_TAB)['key'];

const CLAIM_TEXT: Record<ClaimStatus, string> = {
  PENDING: '审核中',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
  CANCELLED: '已取消'
};

const CLAIM_STYLE: Record<ClaimStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-emerald-100 text-emerald-700',
  REJECTED: 'bg-rose-100 text-rose-700',
  CANCELLED: 'bg-slate-200 text-slate-500'
};

const STATUS_TEXT: Record<string, string> = {
  OPEN: '待认领',
  CLAIMING: '认领中',
  CLAIMED: '已认领',
  RESOLVED: '已归还',
  CLOSED: '已下架'
};

const STATUS_STYLE: Record<string, string> = {
  OPEN: 'bg-emerald-100 text-emerald-700',
  CLAIMING: 'bg-amber-100 text-amber-700',
  CLAIMED: 'bg-indigo-100 text-indigo-700',
  RESOLVED: 'bg-slate-200 text-slate-600',
  CLOSED: 'bg-slate-200 text-slate-500'
};

function ClaimBadge({ status }: { status: ClaimStatus }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${CLAIM_STYLE[status]}`}>
      {CLAIM_TEXT[status]}
    </span>
  );
}

export default function MyPage() {
  const { show } = useToast();
  const user = getCurrentUser();
  const admin = isAdmin();

  const tabs = admin ? [REVIEW_TAB, ...BASE_TABS] : [...BASE_TABS];
  const [tab, setTab] = useState<TabKey>(admin ? 'review' : 'posts');
  const [picked, setPicked] = useState<PickedItem[]>([]);
  const [claimed, setClaimed] = useState<ClaimedRow[]>([]);
  const [pending, setPending] = useState<PendingClaimItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [confirmId, setConfirmId] = useState('');
  // 取消认领弹窗：正在取消的 claimId、选中的原因
  const [cancelClaimId, setCancelClaimId] = useState('');
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS[0]);
  const [cancelCustom, setCancelCustom] = useState('');
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.myItems();
      setPicked(result.pickedItems);
      setClaimed(result.claimedItems);
      if (isAdmin()) {
        const { items } = await api.pendingClaims();
        setPending(items);
      }
    } catch (err) {
      show(err instanceof Error ? err.message : '加载失败，请确认后端已启动', 'error');
    } finally {
      setLoading(false);
    }
  }, [show]);

  useEffect(() => {
    void load();
  }, [load]);

  const review = async (claim: ClaimInfo, decision: 'approve' | 'reject') => {
    setBusyId(claim.id);
    try {
      if (decision === 'approve') {
        await api.approve(claim.id);
        show('已通过认领，状态更新为「已认领」，等待失主确认领取');
      } else {
        await api.reject(claim.id);
        show('已拒绝该认领申请');
      }
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : '操作失败', 'error');
    } finally {
      setBusyId('');
    }
  };

  const confirmReturn = async (itemId: string) => {
    setBusyId(itemId);
    try {
      await api.confirmReturn(itemId);
      show('已确认领取，失物状态更新为「已归还」');
      setConfirmId('');
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : '操作失败', 'error');
    } finally {
      setBusyId('');
    }
  };

  const openCancel = (claimId: string) => {
    setCancelClaimId(claimId);
    setCancelReason(CANCEL_REASONS[0]);
    setCancelCustom('');
  };

  const doCancel = async () => {
    const reason = cancelReason === '其他原因' ? cancelCustom.trim() || '其他原因' : cancelReason;
    setCancelling(true);
    try {
      await api.cancelClaim(cancelClaimId, reason);
      show('已取消该认领申请');
      setCancelClaimId('');
      await load();
    } catch (err) {
      show(err instanceof Error ? err.message : '取消失败', 'error');
    } finally {
      setCancelling(false);
    }
  };

  const renderClaimsBlock = (claims: ClaimInfo[]) => (
    <div className="space-y-2">
      {claims.map((c) => (
        <div key={c.id} className="flex flex-col gap-2 rounded-xl bg-slate-50 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-700">
              {c.claimantName}
              <span className="ml-2 text-xs font-normal text-slate-400">{timeAgo(c.createdAt)}</span>
            </p>
            <p className="truncate text-xs text-slate-500">{c.note}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ClaimBadge status={c.status} />
            {c.status === 'PENDING' && (
              <>
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => void review(c, 'approve')}
                  className="rounded-full bg-emerald-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                >
                  {busyId === c.id ? <Spinner size={12} className="text-white" /> : '通过'}
                </button>
                <button
                  type="button"
                  disabled={busyId === c.id}
                  onClick={() => void review(c, 'reject')}
                  className="rounded-full bg-rose-600 px-3 py-1 text-xs font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
                >
                  拒绝
                </button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  const renderPicked = (item: PickedItem) => (
    <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:w-36">
          <img src={imageSrc(item)} alt={item.description} className="h-full w-full object-cover" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">{item.type}</span>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLE[item.status] ?? 'bg-slate-100 text-slate-600'}`}>
              {STATUS_TEXT[item.status] ?? item.status}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-3 w-3 rounded-full border border-slate-300" style={{ background: colorHex(item.color) }} />
              {item.color}
            </span>
            {item.locationTips && (
              <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">📍 {item.locationTips}</span>
            )}
            <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">🏠 存放：{item.place}</span>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-slate-500">{item.description}</p>
          {item.detailLocation && <p className="mt-1 text-xs text-slate-500">详细地点：{item.detailLocation}</p>}
          {item.informationB && <p className="mt-1 text-xs text-slate-400">其他描述（验证信息）：{item.informationB}</p>}
        </div>
      </div>
      {item.claims.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <p className="text-xs font-semibold text-slate-500">认领申请（{item.claims.length}）</p>
          {renderClaimsBlock(item.claims)}
        </div>
      )}
      {item.status !== 'OPEN' && (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <p className="mb-2 text-xs font-semibold text-slate-500">失物处理进度</p>
          <StatusTimeline
            steps={[
              { label: '你发布了物品', at: item.createdAt },
              { label: '收到认领申请', at: item.claimRequestedAt },
              { label: '审核通过', at: item.claimApprovedAt },
              {
                label: item.status === 'RESOLVED' ? '已归还' : '失主确认领取',
                at: item.status === 'RESOLVED' ? item.returnedAt ?? item.claimedAt : null
              }
            ]}
          />
        </div>
      )}
    </div>
  );

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 sm:text-3xl">我的</h1>
        <p className="mt-1 text-sm text-slate-500">
          当前身份：<span className="font-medium text-blue-600">{user?.displayName}</span>（可在右上角登录 / 切换账号）
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`rounded-full px-5 py-2.5 text-sm font-medium transition ${
              tab === t.key ? 'text-white shadow-md' : 'border border-slate-200 bg-white text-slate-600 hover:border-blue-300'
            }`}
            style={tab === t.key ? { background: 'linear-gradient(135deg,#2563eb,#06b6d4)' } : undefined}
          >
            <span className="mr-1.5">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : tab === 'review' ? (
        pending.length === 0 ? (
          <EmptyState icon="🛡️" title="暂无待审核申请" desc="新的认领申请会出现在这里，通过后失主即可获得地点A" />
        ) : (
          <div className="space-y-4">
            {pending.map(({ item, claims }) => (
              <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md">
                <div className="flex flex-col gap-4 sm:flex-row">
                  <div className="h-28 w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:w-36">
                    <img src={imageSrc(item)} alt={item.description} className="h-full w-full object-cover" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">{item.type}</span>
                      <span className="text-xs font-medium text-slate-400">拾取人：{item.pickerName}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <span className="inline-block h-3 w-3 rounded-full border border-slate-300" style={{ background: colorHex(item.color) }} />
                        {item.color}
                      </span>
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">📍 地点A：{item.place}</span>
                    </div>
                    <p className="mt-2 line-clamp-2 text-sm text-slate-500">{item.description}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
                  <p className="text-xs font-semibold text-slate-500">待审核申请（{claims.length}）</p>
                  {renderClaimsBlock(claims)}
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'posts' ? (
        picked.length === 0 ? (
          <EmptyState
            icon="📤"
            title="还没有发布记录"
            desc="捡到东西了？发布到寻物广场，AI 会自动识别生成标签"
            action={
              <Link to="/publish" className="btn-gradient inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-md">
                去发布
              </Link>
            }
          />
        ) : (
          <div className="space-y-4">{picked.map(renderPicked)}</div>
        )
      ) : claimed.length === 0 ? (
        <EmptyState
          icon="🤝"
          title="还没有认领记录"
          desc="在寻物广场看到疑似自己的物品？申请认领后会显示在这里"
          action={
            <Link to="/hall" className="btn-gradient inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-md">
              去寻物广场看看
            </Link>
          }
        />
      ) : (
        <div className="space-y-4">
          {claimed.map(({ item, claim }) => (
            <div key={claim.id} className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md sm:flex-row sm:items-center">
              <div className="h-24 w-full shrink-0 overflow-hidden rounded-xl bg-slate-100 sm:w-32">
                <img src={imageSrc(item)} alt={item.description} className="h-full w-full object-cover" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-800">{item.type}</h3>
                  <ClaimBadge status={claim.status} />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                  <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs">{item.color}</span>
                  <span className="text-xs text-slate-400">{timeAgo(claim.createdAt)} 提交</span>
                </div>
                <p className="mt-2 line-clamp-1 text-sm text-slate-500">认领说明：{claim.note}</p>
                {claim.status === 'PENDING' && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => openCancel(claim.id)}
                      className="rounded-full border border-rose-200 bg-white px-3 py-1 text-xs font-medium text-rose-600 transition hover:bg-rose-50"
                    >
                      取消认领
                    </button>
                  </div>
                )}
                {claim.status === 'CANCELLED' && claim.cancelReason && (
                  <p className="mt-2 text-xs text-slate-400">取消原因：{claim.cancelReason}</p>
                )}
                {claim.status === 'APPROVED' && item.place && (
                  <div className="mt-2 space-y-1.5">
                    <p className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                      📍 当前失物存放地点：{item.place}
                    </p>
                    {item.detailLocation && (
                      <p className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                        📌 详细地点：{item.detailLocation}
                      </p>
                    )}
                  </div>
                )}
                {claim.status === 'APPROVED' && item.status === 'CLAIMED' && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    {confirmId === item.id ? (
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-slate-600">确认已经领取到该失物吗？确认后状态将更新为「已归还」。</p>
                        <div className="flex shrink-0 gap-2">
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => void confirmReturn(item.id)}
                            className="rounded-full bg-emerald-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-700 disabled:opacity-50"
                          >
                            {busyId === item.id ? <Spinner size={12} className="text-white" /> : '确认领取'}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === item.id}
                            onClick={() => setConfirmId('')}
                            className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-xs font-medium text-slate-600 transition hover:border-slate-300"
                          >
                            取消
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmId(item.id)}
                        className="rounded-full bg-blue-600 px-4 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700"
                      >
                        我已领取到失物
                      </button>
                    )}
                  </div>
                )}
                {claim.status !== 'REJECTED' && claim.status !== 'CANCELLED' && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <p className="mb-2 text-xs font-semibold text-slate-500">失物处理进度</p>
                    <StatusTimeline
                      steps={[
                        { label: '拾取者发布物品', at: item.createdAt },
                        { label: '你申请认领', at: claim.createdAt },
                        { label: '拾取者审核通过', at: claim.status === 'APPROVED' ? claim.reviewedAt : null },
                        {
                          label: item.status === 'RESOLVED' ? '已归还' : '失主确认领取',
                          at: item.status === 'RESOLVED' ? item.returnedAt ?? item.claimedAt : null
                        }
                      ]}
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!cancelClaimId}
        title="取消认领申请"
        confirmText="确认取消"
        confirmTone="danger"
        loading={cancelling}
        onConfirm={() => void doCancel()}
        onClose={() => setCancelClaimId('')}
      >
        <div className="space-y-3">
          <p className="text-sm text-slate-600">请选择取消原因（帮助我们改进匹配）：</p>
          <div className="space-y-2">
            {CANCEL_REASONS.map((r) => (
              <label key={r} className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50">
                <input
                  type="radio"
                  name="cancelReason"
                  checked={cancelReason === r}
                  onChange={() => setCancelReason(r)}
                />
                {r}
              </label>
            ))}
          </div>
          {cancelReason === '其他原因' && (
            <input
              value={cancelCustom}
              onChange={(e) => setCancelCustom(e.target.value)}
              placeholder="请简单说明原因（可选）"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          )}
        </div>
      </Modal>
    </div>
  );
}