import { useEffect, useMemo, useState } from 'react';
import EmptyState from '../components/EmptyState';
import ItemCard from '../components/ItemCard';
import SkeletonCard from '../components/SkeletonCard';
import { api, type PublicItem } from '../lib/api';
import { Link } from '../lib/router';

const TYPES = ['全部', '证件', '电子产品', '文具', '衣物', '水杯', '钥匙', '其他'];

export default function HallPage() {
  const [keyword, setKeyword] = useState('');
  const [type, setType] = useState('全部');
  const [items, setItems] = useState<PublicItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const { items: list } = await api.lostItems();
      setItems(list);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败，请确认后端已启动');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const kw = keyword.trim().toLowerCase();
    return items.filter((it) => {
      const kwOk =
        !kw ||
        [it.description, it.color, it.type, it.category, it.locationTips]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(kw);
      const typeOk = type === '全部' || it.type === type;
      return kwOk && typeOk;
    });
  }, [items, keyword, type]);

  return (
    <div className="animate-fade-up space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 sm:text-3xl">失物大厅</h1>
        <p className="mt-1 text-sm text-slate-500">
          按类型筛选、关键词搜索；存放地点与详细地点已隐藏，认领通过后仅对申请者可见；📍 地点Tips 为公开提示
        </p>
      </div>

      {error && (
        <div className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          <span>{error}</span>
          <button type="button" onClick={() => void load()} className="shrink-0 rounded-full bg-rose-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-rose-700">
            重试
          </button>
        </div>
      )}

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索描述 / 颜色 / 地点Tips…"
            className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
          />
        </div>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none transition focus:border-blue-400"
        >
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t === '全部' ? '全部类型' : t}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={error ? '加载失败' : '没有找到相关失物'}
          desc={error ? '请确认后端已启动（npm run dev）' : '换个关键词或类型试试，也可以去发布你拾到的物品'}
          action={
            <Link to="/publish" className="btn-gradient inline-block rounded-full px-6 py-2.5 text-sm font-semibold text-white shadow-md">
              去发布失物
            </Link>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((it) => (
            <ItemCard key={it.id} item={it} onChanged={() => void load()} />
          ))}
        </div>
      )}
    </div>
  );
}