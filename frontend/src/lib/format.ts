export function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return '刚刚';
  if (min < 60) return `${min} 分钟前`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour} 小时前`;
  const day = Math.floor(hour / 24);
  return `${day} 天前`;
}

/** 格式化为「8月20日 10:30」形式，用于状态时间线等场景 */
export function formatDateTime(ts: number): string {
  const d = new Date(ts);
  const mm = d.getMonth() + 1;
  const dd = d.getDate();
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}月${dd}日 ${hh}:${mi}`;
}

const COLOR_MAP: Record<string, string> = {
  黑色: '#1e293b',
  白色: '#f8fafc',
  灰色: '#94a3b8',
  银色: '#cbd5e1',
  蓝色: '#3b82f6',
  红色: '#ef4444',
  绿色: '#22c55e',
  黄色: '#facc15',
  粉色: '#f472b6',
  紫色: '#a855f7',
  橙色: '#f97316',
  棕色: '#92400e',
  藏青色: '#1e3a8a',
};

export function colorHex(color: string): string {
  return COLOR_MAP[color] ?? '#cbd5e1';
}
