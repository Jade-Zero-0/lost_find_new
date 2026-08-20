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
