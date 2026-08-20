import { useEffect, useState } from 'react';
import Modal from '../components/Modal';
import StatusTimeline from '../components/StatusTimeline';
import { Spinner } from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { api, type PublicItem } from '../lib/api';
import { colorHex, timeAgo } from '../lib/format';
import { imageSrc } from '../lib/image';
import { Link, navigate } from '../lib/router';
import { isLoggedIn } from '../lib/user';

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

const CLAIM_STATUS_TEXT: Record<string, string> = {
  PENDING: '认领审核中',
  APPROVED: '认领已通过',
  REJECTED: '认领被拒绝',
  CANCELLED: '认领已撤回'
};

/** 实物详细信息展示页（路由 /items/:id）：大图 + AI 特征 + 状态时间线 + 认领入口 */
export default function DetailPage({ id }: { id: string }) {
  const { show } = useToast();
  const [item, setItem] = useState<PublicItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [note, setNote] = useState('我在寻物广场看到这件物品，特此申请认领。');

  const load = () => {
    setLoading(true);
    api
      .itemDetail(id)
      .then(({ item }) => {
        setItem(item);
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const openClaim = () => {
    if (!isLoggedIn()) {
      show('请先登录后再申请认领', 'error');
      navigate('/login');
      return;
    }
    setNote('我在寻物广场看到这件物品，特此申请认领。');
    setConfirmOpen(true);
  };

  const handleClaim = async () => {
    if (!item) return;
    setClaiming(true);
    try {
      await api.claim({ itemId: item.id, note: note.trim() || '申请认领' });
      show('认领申请已提交，等待审核');
      setConfirmOpen(false);
      load();
    } catch (err) {
      show(err instanceof Error ? err.message : '认领失败', 'error');
    } finally {
      setClaiming(false);
    }
  };

  // ===== 加载中 / 出错 =====
  if (loading) {
    return (
      <div className="mx-auto grid max-w-lg place-items-center rounded-3xl border border-slate-200 bg-white py-24 shadow-sm">
        <Spinner size={32} className="text-indigo-600" />
        <p className="mt-4 text-sm text-slate-500">正在加载物品详情…</p>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-3xl">🤔</span>
        <h2 className="mt-5 text-lg font-bold text-slate-800">{error || '物品不存在'}</h2>
        <Link to="/hall" className="btn-gradient mt-6 inline-block rounded-full px-7 py-3 text-sm font-semibold text-white shadow-md">
          返回寻物广场
        </Link>
      </div>
    );
  }

  // AI 识别标签（过滤未知/空值）
  const tags: { label: string; value: string; tone: string }[] = [];
  if (item.category && item.category !== item.type) tags.push({ label: '类别', value: item.category, tone: 'indigo' });
  if (item.shape && item.shape !== '未知') tags.push({ label: '形状', value: item.shape, tone: 'slate' });
  if (item.material && item.material !== '未知') tags.push({ label: '材质', value: item.material, tone: 'slate' });
  if (item.text && item.text !== '无') tags.push({ label: '文字', value: item.text, tone: 'amber' });

  const toneClass: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-600',
    slate: 'bg-slate-100 text-slate-600',
    amber: 'bg-amber-50 text-amber-700'
  };

  const canClaim = item.status === 'OPEN' && (!item.myClaim || item.myClaim.status === 'REJECTED' || item.myClaim.status === 'CANCELLED');

  return (
    <div className="animate-fade-up mx-auto max-w-5xl">
      {/* 返回 */}
      <button
        type="button"
        onClick={() => (window.history.length > 1 ? window.history.back() : navigate('/hall'))}
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition hover:text-indigo-600"
      >
        ‹ 返回
      </button>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* 左：大图 */}
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-100 shadow-sm">
          <div className="relative aspect-square">
            <img src={imageSrc(item)} alt={item.description} className="h-full w-full object-cover" />
            <span className={`absolute right-4 top-4 rounded-full px-3 py-1 text-xs font-semibold shadow-sm ${STATUS_STYLE[item.status] ?? ''}`}>
              {STATUS_TEXT[item.status] ?? item.status}
            </span>
          </div>
        </div>

        {/* 右：信息 */}
        <div className="flex flex-col gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-sm font-semibold text-blue-700">{item.type}</span>
              <span className="inline-flex items-center gap-1.5 text-sm text-slate-500">
                <span className="inline-block h-3 w-3 rounded-full border border-slate-300" style={{ background: colorHex(item.color) }} />
                {item.color}
              </span>
            </div>
            <p className="mt-3 text-base leading-relaxed text-slate-700">{item.description}</p>
          </div>

          {/* AI 识别特征 */}
          {(tags.length > 0 || item.features || item.aiConfidence != null) && (
            <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-indigo-500">
                🤖 AI 识别特征
                {item.aiConfidence != null && (
                  <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-medium text-blue-600">
                    置信度 {(item.aiConfidence * 100).toFixed(0)}%
                  </span>
                )}
              </p>
              {tags.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {tags.map((t) => (
                    <span key={t.label} className={`rounded-full px-2.5 py-1 text-xs font-medium ${toneClass[t.tone]}`}>
                      {t.label}：{t.value}
                    </span>
                  ))}
                </div>
              )}
              {item.features && <p className="mt-2.5 text-sm leading-relaxed text-slate-600">{item.features}</p>}
            </div>
          )}

          {/* 公开地点提示 */}
          {item.locationTips && (
            <div className="flex items-start gap-2 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4">
              <span className="text-lg">📍</span>
              <div>
                <p className="text-xs font-semibold text-emerald-600">大致拾取区域</p>
                <p className="mt-0.5 text-sm text-slate-600">{item.locationTips}</p>
                <p className="mt-1 text-xs text-slate-400">精确存放位置将在认领审核通过后告知</p>
              </div>
            </div>
          )}

          {/* 认领状态 / 按钮 */}
          {item.myClaim && item.myClaim.status !== 'REJECTED' && item.myClaim.status !== 'CANCELLED' && (
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              你对该物品的认领状态：<strong className="text-indigo-600">{CLAIM_STATUS_TEXT[item.myClaim.status]}</strong>
            </div>
          )}

          {canClaim ? (
            <button
              type="button"
              onClick={openClaim}
              className="btn-gradient rounded-full py-3.5 text-center font-semibold text-white shadow-lg"
            >
              这是我的，申请认领
            </button>
          ) : (
            <div className="rounded-full bg-slate-100 py-3.5 text-center text-sm font-medium text-slate-500">
              {item.status === 'OPEN' ? '你已提交认领，请耐心等待审核' : `当前状态：${STATUS_TEXT[item.status] ?? item.status}，暂不可认领`}
            </div>
          )}
        </div>
      </div>

      {/* 处理进度时间线 */}
      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h3 className="mb-4 text-base font-bold text-slate-800">处理进度</h3>
        <StatusTimeline
          steps={[
            { label: '拾取者登记发布', at: item.createdAt },
            { label: '失主申请认领', at: item.claimRequestedAt ?? (item.status !== 'OPEN' ? item.createdAt : null) },
            { label: '审核通过', at: item.claimApprovedAt ?? (item.status === 'CLAIMED' || item.status === 'RESOLVED' ? item.claimedAt : null) },
            { label: '失主确认领取（归还完成）', at: item.returnedAt ?? (item.status === 'RESOLVED' ? item.claimedAt : null) }
          ]}
        />
        <p className="mt-2 text-xs text-slate-400">
          发布于 {timeAgo(item.createdAt)} · 拾取者：{item.pickerName}
        </p>
      </div>

      {/* 二次确认弹窗 */}
      <Modal
        open={confirmOpen}
        title="确认申请认领"
        confirmText="确认认领"
        confirmTone="primary"
        loading={claiming}
        onConfirm={() => void handleClaim()}
        onClose={() => setConfirmOpen(false)}
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-xl bg-slate-50 p-3">
            <img src={imageSrc(item)} alt={item.description} className="h-14 w-14 shrink-0 rounded-lg object-cover" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-700">{item.type} · {item.color}</p>
              <p className="line-clamp-1 text-xs text-slate-500">{item.description}</p>
            </div>
          </div>
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-700">
            ⚠️ 请确认这确实是<strong>你本人</strong>丢失的物品。认领通过后拾取者会核对你提供的特征信息，冒领将无法通过审核。
          </p>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">认领说明（可补充物品特征帮助核验）</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="例如：这是我的黑色保温杯，杯底有蓝色贴纸，昨天在图书馆丢失。"
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
