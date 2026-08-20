import { formatDateTime } from '../lib/format';

/** 时间线单步：done 表示已完成（显示对勾+时间），未完成显示灰色空心点 */
interface Step {
  label: string;
  at?: number | null;
}

/**
 * 失物处理进度时间线：
 * 发布 → 申请认领 → 审核通过 → 确认领取(已归还)。
 * 传入各节点时间戳，已发生的节点点亮并显示时间，未发生的置灰。
 */
export default function StatusTimeline({ steps }: { steps: Step[] }) {
  // 最后一个已完成节点之前的步骤都视为已完成（时间戳可能缺失，如旧数据）
  const lastDone = steps.reduce((acc, s, i) => (s.at ? i : acc), -1);

  return (
    <ol className="space-y-0">
      {steps.map((s, i) => {
        const done = i <= lastDone;
        const isLast = i === steps.length - 1;
        return (
          <li key={s.label} className="relative flex gap-3 pb-4 last:pb-0">
            {/* 连接线 */}
            {!isLast && (
              <span
                className={`absolute left-[7px] top-4 h-full w-0.5 ${i < lastDone ? 'bg-emerald-300' : 'bg-slate-200'}`}
                aria-hidden
              />
            )}
            {/* 节点圆点 */}
            <span
              className={`relative z-10 mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
                done ? 'border-emerald-500 bg-emerald-500' : 'border-slate-300 bg-white'
              }`}
            >
              {done && (
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 12.5l5 5L20 6.5" />
                </svg>
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className={`text-sm font-medium ${done ? 'text-slate-700' : 'text-slate-400'}`}>{s.label}</p>
              {s.at ? (
                <p className="text-xs text-slate-400">{formatDateTime(s.at)}</p>
              ) : (
                <p className="text-xs text-slate-300">待进行</p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
