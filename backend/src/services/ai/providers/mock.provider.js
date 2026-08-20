/**
 * 模拟 AI 视觉识别提供商（Demo 用，不调用真实 AI）
 *
 * 原理：对图片 dataURL 做哈希得到种子，用种子随机数从标签库中挑选，
 * 保证「同一张图识别结果稳定、不同图片结果不同」，并模拟 700~1300ms 识别耗时。
 */
export const name = 'mock';

const TYPES = ['校园卡', '蓝牙耳机', '保温杯', '折叠雨伞', '钥匙串', '笔记本', '充电宝', '手机', '眼镜', '手表', '外套', '帽子', '书包', '计算器', 'U盘', '水卡', '钢笔', '校园卡'];
const COLORS = ['蓝色', '黑色', '白色', '红色', '银色', '粉色', '绿色', '灰色', '藏青色', '橙色', '紫色', '棕色'];
const SHAPES = ['长方形', '正方形', '圆形', '椭圆形', '圆柱形', '不规则形'];
const FEATURES = ['透明卡套', '卡通挂件', '轻微划痕', '品牌logo', '挂绳', '贴纸', '磨损边角', '拉链', '钥匙扣', '印花图案'];
const MATERIALS = ['塑料', '金属', '布料', '皮革', '纸质', '玻璃', '硅胶', '木质'];

function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick(list, rnd) {
  return list[Math.floor(rnd() * list.length)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 识别图片
 * @param {{ dataUrl?: string, imagePath?: string, imageBuffer?: Buffer }} input
 */
export async function recognize({ dataUrl = '' } = {}) {
  const seed = hashString(dataUrl);
  const rnd = mulberry32(seed);
  await sleep(700 + Math.floor(rnd() * 600));
  return {
    type: pick(TYPES, rnd),
    color: pick(COLORS, rnd),
    shape: pick(SHAPES, rnd),
    feature: pick(FEATURES, rnd),
    material: pick(MATERIALS, rnd),
    text: '无',
    confidence: Math.round((0.8 + rnd() * 0.19) * 100) / 100,
    provider: 'mock'
  };
}