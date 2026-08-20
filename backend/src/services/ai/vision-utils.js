import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * 视觉识别共享工具：固定 Prompt / 图片解析 / JSON 容错提取 / 字段规范化
 * 被 glmVisionService（智谱）与 deepseekVisionService（DeepSeek V4）复用，
 * 未来接入其他视觉模型时同样可直接复用。
 */

/** 固定 Prompt：要求模型只输出严格 JSON（category/color/shape/material/features/text/confidence） */
export const VISION_PROMPT = `你是一个校园失物招领平台的物品识别专家。请分析图片中的失物，并严格只输出一个 JSON 对象，不要输出任何其他文字或 Markdown 代码块。
JSON 字段说明：
- category：物品类别（简短描述，如"黑色水杯""蓝色校园卡"）
- color：主颜色
- shape：形状
- material：材质
- features：外观特征
- text：图片中可辨认的文字（如学号、姓名、品牌名；若没有则填"无"）
- confidence：识别置信度，0 到 1 之间的小数
输出示例：{"category":"黑色水杯","color":"黑色","shape":"圆柱形","material":"塑料","features":"杯身有白色logo","text":"无","confidence":0.92}`;

const MIME_MAP = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif'
};

export function toDataUrl(buffer, mime = 'image/jpeg') {
  return `data:${mime};base64,${buffer.toString('base64')}`;
}

/** 支持输入：dataURL / 纯 Base64 / 图片文件路径 / Buffer */
export async function resolveImage(image) {
  if (Buffer.isBuffer(image)) return toDataUrl(image);
  if (typeof image !== 'string' || image.trim() === '') {
    throw new Error('图片参数无效，请提供图片路径或 Base64 数据');
  }
  const s = image.trim();
  if (s.startsWith('data:image/')) return s;
  // 纯 Base64：长度足够且为 4 的倍数
  if (s.length >= 100 && s.length % 4 === 0 && /^[A-Za-z0-9+/=\r\n]+$/.test(s)) {
    return toDataUrl(Buffer.from(s, 'base64'));
  }
  // 视为文件路径
  const abs = path.resolve(s);
  try {
    const buffer = await fs.readFile(abs);
    const mime = MIME_MAP[path.extname(abs).toLowerCase()] || 'image/jpeg';
    return toDataUrl(buffer, mime);
  } catch {
    throw new Error('无法读取图片文件，请检查图片路径是否正确');
  }
}

/** 从模型输出中提取并解析 JSON（容忍 ```json 围栏与前后杂文） */
export function extractJson(text) {
  const cleaned = String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) {
    throw new Error('模型输出中未找到 JSON 对象');
  }
  return JSON.parse(cleaned.slice(start, end + 1));
}

/** 规范化字段（截断长度、约束置信度范围） */
export function normalizeVisionResult(raw) {
  const confidence = Number(raw?.confidence);
  return {
    category: String(raw?.category ?? '未知物品').slice(0, 50),
    color: String(raw?.color ?? '未指定').slice(0, 20),
    shape: String(raw?.shape ?? '未知').slice(0, 20),
    material: String(raw?.material ?? '未知').slice(0, 20),
    features: String(raw?.features ?? '').slice(0, 200),
    text: String(raw?.text ?? '无').slice(0, 100),
    confidence: Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : null
  };
}

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}