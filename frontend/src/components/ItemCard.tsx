import { useState } from 'react';
import { api, type PublicItem } from '../lib/api';
import { colorHex, timeAgo } from '../lib/format';
import { imageSrc } from '../lib/image';
import { navigate } from '../lib/router';
import { isLoggedIn } from '../lib/user';
import { useToast } from './Toast';

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

  const handleClaim = async () => {
    if (!isLoggedIn()) {
      show('请先登录后再申请认领', 'error');
      navigate('/login');
      return;
    }
    setClaiming(true);
    try {
      await api.claim({
        itemId: item.id,
        note: '我在失物大厅看到这件物品，特此申请认领。'
      });
      show('认领申请已提交，等待审核');
      onChanged?.();
    } catch (err) {
      show(err instanceof Error ? err.message : '认领失败', 'error');
    } finally {
      setClaiming(false);
    }
  };

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
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
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <span
            className="inline-block h-3 w-3 rounded-full border border-slate-300"
            style={{ background: colorHex(item.color) }}
          />
          <span>{item.color}</span>
        </div>
        <p className="line-clamp-2 flex-1 text-sm leading-relaxed text-slate-500">{item.description}</p>

        {item.category && item.category !== item.type && (
          <span className="self-start rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600">
            🤖 {item.category}
          </span>
        )}
        {item.locationTips && (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
            📍 {item.locationTips}
          </span>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-3">
          <span className="text-xs text-slate-400">
            {timeAgo(item.createdAt)} · {item.pickerName}
          </span>
          {!own && item.status === 'OPEN' ? (
            <button
              type="button"
              disabled={claiming}
              onClick={handleClaim}
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
  );
}