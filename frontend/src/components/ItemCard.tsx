import { useState } from 'react';
import { api, type PublicItem } from '../lib/api';
import { colorHex, timeAgo } from '../lib/format';
import { imageSrc } from '../lib/image';
import { navigate } from '../lib/router';
import { isLoggedIn } from '../lib/user';
import { useToast } from './Toast';
import Modal from './Modal';

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

export default function ItemCard({
  item,
  own = false,
  onChanged
}: {
  item: PublicItem;
  own?: boolean;
  onChanged?: () => void;
}) {
  const { show } = useToast();
  const [claiming, setClaiming] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [note, setNote] = useState('我在寻物广场看到这件物品，特此申请认领。');

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
    setClaiming(true);
    try {
      await api.claim({
        itemId: item.id,
        note: note.trim() || '申请认领'
      });
      show('认领申请已提交，等待审核');
      setConfirmOpen(false);
      onChanged?.();
    } catch (err) {
      show(err instanceof Error ? err.message : '认领失败', 'error');
    } finally {
      setClaiming(false);
    }
  };

  // 进入详情页：整张卡片可点击；内部的认领按钮通过 stopPropagation 阻止冒泡
  const goDetail = () => navigate(`/items/${item.id}`);

  return (
    <>
      <article
        role="button"
        tabIndex={0}
        onClick={goDetail}
        onKeyDown={(e) => {
          if (e.key === 'Enter') goDetail();
        }}
        title="点击查看物品详情"
        className="group flex cursor-pointer flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:border-blue-200 hover:shadow-xl"
      >
        <div className="relative aspect-[3/2] overflow-hidden bg-slate-100">
        <img
          src={imageSrc(item)}
          alt={item.description}
          loading="lazy"
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-blue-700 shadow-sm">
          {item.type}
        </span>
        {item.aiStatus === 'processing' && (
          <span className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-indigo-500/90 px-2.5 py-1 text-xs font-semibold text-white shadow-sm">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            AI 分析中…
          </span>
        )}
        {item.status !== 'OPEN' && (
          <span className={`absolute right-3 top-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm ${STATUS_STYLE[item.status] ?? ''}`}>
            {STATUS_TEXT[item.status] ?? item.status}
          </span>
        )}
        <span className="absolute bottom-3 right-3 flex items-center gap-1 rounded-full bg-slate-800/70 px-2.5 py-1 text-[11px] font-medium text-white shadow-sm backdrop-blur-sm">
          点击查看详情 →
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span
            className="inline-block h-3 w-3 rounded-full border border-slate-300"
            style={{ background: colorHex(item.color) }}
          />
          <span>{item.color}</span>
        </div>
        <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-slate-500">
          {item.description}
        </p>

        {/* AI 识别标签：类别 / 形状 / 材质 / 特征 / 文字，帮助失主快速辨认 */}
        {(item.category || item.shape || item.material || item.features || item.text) && (
          <div className="flex flex-wrap gap-1.5">
            {item.category && item.category !== item.type && (
              <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
                🤖 {item.category}
              </span>
            )}
            {item.shape && item.shape !== '未知' && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                形状：{item.shape}
              </span>
            )}
            {item.material && item.material !== '未知' && (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                材质：{item.material}
              </span>
            )}
            {item.text && item.text !== '无' && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                🔤 {item.text}
              </span>
            )}
          </div>
        )}
        {item.features && (
          <p className="line-clamp-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs leading-relaxed text-slate-500">
            <span className="font-medium text-slate-600">特征：</span>{item.features}
          </p>
        )}
        {item.locationTips && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            📍 {item.locationTips}
          </span>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-xs font-medium text-slate-400">
            {timeAgo(item.createdAt)} · {item.pickerName}
            <span className="ml-1 font-semibold text-indigo-600">· 查看详情 ›</span>
          </span>
          {!own && item.status === 'OPEN' ? (
            <button
              type="button"
              disabled={claiming}
              onClick={(e) => {
                e.stopPropagation();
                openClaim();
              }}
              className="rounded-full bg-blue-600 px-3.5 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {claiming ? '提交中…' : '申请认领'}
            </button>
          ) : (
            <span className="text-xs font-medium text-slate-400">
              {own ? '我发布的' : (STATUS_TEXT[item.status] ?? item.status)}
            </span>
          )}
        </div>
        </div>
      </article>

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
    </>
  );
}