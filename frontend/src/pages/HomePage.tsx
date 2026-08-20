import { useEffect, useState } from 'react';
import ItemCard from '../components/ItemCard';
import SkeletonCard from '../components/SkeletonCard';
import { api, type PublicItem } from '../lib/api';
import { Link } from '../lib/router';

const FEATURES = [
  {
    icon: '🤖',
    title: 'AI 智能识别',
    desc: '上传拾物照片，AI 自动识别物品类型、颜色、形状与特征，发布更快更准确。'
  },
  {
    icon: '📤',
    title: '一键发布',
    desc: '拍照、填地点、写描述，30 秒完成拾物登记，让失主更快找到它。'
  },
  {
    icon: '🛡️',
    title: '隐私保护',
    desc: '拾取地点（地点A）不在大厅公开，认领审核通过后才会告知失主存放位置。'
  }
];

export default function HomePage() {
  const [latest, setLatest] = useState<PublicItem[]>([]);
  const [total, setTotal] = useState(0);
  const [openCount, setOpenCount] = useState(0);
  const [claimCount, setClaimCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api
      .lostItems()
      .then(({ items }) => {
        if (cancelled) return;
        const sorted = items.slice().sort((a, b) => b.createdAt - a.createdAt);
        setLatest(sorted.slice(0, 3));
        setTotal(items.length);
        setOpenCount(items.filter((i) => i.status === 'OPEN').length);
        setClaimCount(items.reduce((sum, i) => sum + (i.claimCount || 0), 0));
      })
      .catch(() => {
        // 后端未启动时静默降级为 0
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-10">
      <section className="tech-hero animate-fade-up rounded-3xl border border-slate-200/70 bg-white/70 px-6 py-12 text-center shadow-sm sm:px-14 sm:py-16">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
          ✨ 校园创新创业 Demo
        </span>
        <h1 className="mx-auto mt-5 max-w-3xl text-3xl font-extrabold leading-tight text-slate-800 sm:text-5xl">
          让每一件失物，
          <br />
          <span className="text-gradient">都能回家</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-sm leading-relaxed text-slate-500 sm:text-base">
          AI寻物宝是面向校园的智能失物招领平台。拾取者上传照片，AI 自动识别生成物品标签；
          失主在失物大厅浏览、申请认领，审核通过后获取存放位置，安全又高效。
        </p>

        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link to="/hall" className="btn-gradient w-full rounded-full px-8 py-3.5 text-center font-semibold text-white shadow-lg sm:w-auto">
            🧭 进入失物大厅
          </Link>
          <Link to="/publish" className="w-full rounded-full border border-slate-300 bg-white px-8 py-3.5 text-center font-semibold text-slate-700 transition hover:border-blue-400 hover:text-blue-600 sm:w-auto">
            📤 发布失物
          </Link>
        </div>

        <div className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-3">
          {[
            { num: total, label: '件在招失物' },
            { num: openCount, label: '件待认领' },
            { num: claimCount, label: '次认领申请' }
          ].map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-200/70 bg-white/80 px-3 py-4">
              <div className="text-2xl font-extrabold text-blue-600 sm:text-3xl">{s.num}</div>
              <div className="mt-1 text-xs text-slate-500 sm:text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {FEATURES.map((f, idx) => (
          <div
            key={f.title}
            className="animate-fade-up rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            style={{ animationDelay: `${idx * 90}ms` }}
          >
            <div
              className="animate-floaty grid h-12 w-12 place-items-center rounded-2xl text-2xl"
              style={{ background: 'linear-gradient(135deg,#eff6ff,#ecfeff)' }}
            >
              {f.icon}
            </div>
            <h3 className="mt-4 font-semibold text-slate-800">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
          </div>
        ))}
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-800 sm:text-2xl">最新失物</h2>
            <p className="mt-1 text-sm text-slate-500">刚登记的失物，快去看看吧</p>
          </div>
          <Link to="/hall" className="text-sm font-medium text-blue-600 hover:text-blue-700">
            查看全部 →
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {latest.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}