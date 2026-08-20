import { useEffect, useState } from 'react';
import { Spinner } from '../components/LoadingSpinner';
import { api, type StatsData } from '../lib/api';
import { Link } from '../lib/router';

const STAT_CARDS: { key: keyof StatsData['totals']; label: string; emoji: string; color: string }[] = [
  { key: 'published', label: '累计登记失物', emoji: '📦', color: 'text-blue-600' },
  { key: 'open', label: '正在招领', emoji: '🔎', color: 'text-emerald-600' },
  { key: 'claiming', label: '认领处理中', emoji: '⏳', color: 'text-amber-600' },
  { key: 'returned', label: '成功归还', emoji: '🎉', color: 'text-indigo-600' }
];

/** 平台成果展示栏（路由 /stats）：累计发布 / 找回率 / 近7天趋势 / 高频拾取地点 */
export default function StatsPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .stats()
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '加载失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="mx-auto grid max-w-lg place-items-center rounded-3xl border border-slate-200 bg-white py-24 shadow-sm">
        <Spinner size={32} className="text-indigo-600" />
        <p className="mt-4 text-sm text-slate-500">正在统计平台成果…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-slate-100 text-3xl">📊</span>
        <h2 className="mt-5 text-lg font-bold text-slate-800">{error || '暂无统计数据'}</h2>
        <Link to="/hall" className="btn-gradient mt-6 inline-block rounded-full px-7 py-3 text-sm font-semibold text-white shadow-md">
          去寻物广场看看
        </Link>
      </div>
    );
  }

  const maxTrend = Math.max(1, ...data.trend7.map((t) => t.count));

  return (
    <div className="animate-fade-up mx-auto max-w-5xl space-y-8">
      {/* 顶部标题 + 找回率 */}
      <section className="tech-hero rounded-3xl border border-slate-200/70 bg-white/70 px-6 py-10 text-center shadow-sm sm:px-12">
        <h1 className="text-2xl font-extrabold text-slate-800 sm:text-3xl">平台成果看板</h1>
        <p className="mx-auto mt-2 max-w-xl text-sm text-slate-500">
          AI寻物宝正在帮助越来越多的师生找回丢失物品，这是我们共同的成果。
        </p>
        <div className="mx-auto mt-8 flex max-w-sm flex-col items-center">
          <div className="relative grid h-40 w-40 place-items-center">
            <svg viewBox="0 0 120 120" className="h-40 w-40 -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="#e2e8f0" strokeWidth="12" />
              <circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="#6366f1"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${(data.returnRate / 100) * 2 * Math.PI * 52} ${2 * Math.PI * 52}`}
              />
            </svg>
            <div className="absolute text-center">
              <div className="text-3xl font-extrabold text-indigo-600">{data.returnRate}%</div>
              <div className="mt-0.5 text-xs text-slate-400">物品找回率</div>
            </div>
          </div>
        </div>
      </section>

      {/* 核心指标卡 */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STAT_CARDS.map((c) => (
          <div key={c.key} className="rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
            <div className="text-2xl">{c.emoji}</div>
            <div className={`mt-2 text-3xl font-extrabold ${c.color}`}>{data.totals[c.key]}</div>
            <div className="mt-1 text-xs text-slate-500">{c.label}</div>
          </div>
        ))}
      </section>

      {/* 近 7 天发布趋势 */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-800">近 7 天新增登记趋势</h2>
        <div className="mt-6 flex items-end justify-between gap-2 sm:gap-4" style={{ height: 160 }}>
          {data.trend7.map((t) => (
            <div key={t.date} className="flex flex-1 flex-col items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">{t.count}</span>
              <div className="flex w-full flex-1 items-end">
                <div
                  className="w-full rounded-t-lg bg-gradient-to-t from-blue-500 to-cyan-400 transition-all"
                  style={{ height: `${Math.max(4, (t.count / maxTrend) * 100)}%` }}
                  title={`${t.date}：${t.count} 件`}
                />
              </div>
              <span className="text-[11px] text-slate-400">{t.date}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 高频拾取地点 */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-base font-bold text-slate-800">高频拾取地点 Top 5</h2>
        {data.topTips.length === 0 ? (
          <p className="mt-4 text-sm text-slate-400">暂无足够数据，发布物品并填写地点提示后即可统计。</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {data.topTips.map((tip, i) => {
              const max = Math.max(1, ...data.topTips.map((t) => t.count));
              return (
                <li key={tip.location} className="flex items-center gap-3">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-indigo-50 text-xs font-bold text-indigo-600">
                    {i + 1}
                  </span>
                  <span className="w-28 shrink-0 truncate text-sm text-slate-600" title={tip.location}>
                    {tip.location}
                  </span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full rounded-full bg-indigo-500" style={{ width: `${(tip.count / max) * 100}%` }} />
                  </div>
                  <span className="w-10 shrink-0 text-right text-sm font-medium text-slate-500">{tip.count}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="flex flex-col justify-center gap-3 sm:flex-row">
        <Link to="/hall" className="btn-gradient rounded-full px-8 py-3 text-center text-sm font-semibold text-white shadow-md">
          🧭 进入寻物广场
        </Link>
        <Link to="/match" className="rounded-full border border-indigo-300 bg-indigo-50 px-8 py-3 text-center text-sm font-semibold text-indigo-600 transition hover:bg-indigo-100">
          🔍 识图找失物
        </Link>
      </div>
    </div>
  );
}
