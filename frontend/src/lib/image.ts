import { apiBase } from './config';

const TYPE_EMOJI: Record<string, string> = {
  证件: '🪪',
  校园卡: '🪪',
  水卡: '💳',
  银行卡: '💳',
  电子产品: '📱',
  手机: '📱',
  充电宝: '🔋',
  耳机: '🎧',
  蓝牙耳机: '🎧',
  计算器: '🧮',
  U盘: '💾',
  文具: '✏️',
  钢笔: '🖊️',
  笔记本: '📓',
  衣物: '🧥',
  外套: '🧥',
  帽子: '🧢',
  水杯: '🥤',
  保温杯: '🥤',
  钥匙: '🔑',
  钥匙串: '🔑',
  其他: '📦',
  雨伞: '☂️',
  折叠雨伞: '☂️',
  眼镜: '👓',
  手表: '⌚',
  书包: '🎒'
};

const GRADIENTS: Array<[string, string]> = [
  ['#4f46e5', '#06b6d4'],
  ['#7c3aed', '#ec4899'],
  ['#0ea5e9', '#22c55e'],
  ['#f59e0b', '#ef4444'],
  ['#14b8a6', '#3b82f6'],
  ['#8b5cf6', '#f43f5e']
];

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

/** 无图时生成离线可用的 SVG 占位图（data URI） */
export function itemPlaceholder(item: { id: string; type: string }): string {
  const [c1, c2] = GRADIENTS[hashString(item.id) % GRADIENTS.length];
  const emoji = TYPE_EMOJI[item.type] ?? '📦';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="400">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/>` +
    `</linearGradient></defs>` +
    `<rect width="600" height="400" fill="url(#g)"/>` +
    `<circle cx="480" cy="60" r="120" fill="rgba(255,255,255,0.12)"/>` +
    `<circle cx="80" cy="340" r="90" fill="rgba(255,255,255,0.10)"/>` +
    `<text x="300" y="225" font-size="120" text-anchor="middle">${emoji}</text>` +
    `</svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

export function imageSrc(item: { imageUrl?: string; id: string; type: string }): string {
  if (item.imageUrl && item.imageUrl.length > 0) {
    // 相对路径（如 /uploads/xxx.png）自动拼接后端地址；已是绝对 URL 则原样返回
    return /^https?:\/\//i.test(item.imageUrl) ? item.imageUrl : `${apiBase()}${item.imageUrl}`;
  }
  return itemPlaceholder(item);
}

/** 压缩图片为 dataURL（默认最长边 900px），避免请求体过大 */
export function downscaleImage(file: File, maxSize = 900, quality = 0.82): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        URL.revokeObjectURL(url);
        reject(new Error('canvas 不可用'));
        return;
      }
      ctx.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('图片读取失败'));
    };
    img.src = url;
  });
}