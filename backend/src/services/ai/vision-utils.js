import { promises as fs } from 'node:fs';
import path from 'node:path';

/**
 * 视觉识别共享工具：固定 Prompt / 图片解析 / JSON 容错提取 / 字段规范化
 * 被 glmVisionService（智谱）与 deepseekVisionService（DeepSeek V4）复用，
 * 未来接入其他视觉模型时同样可直接复用。
 */

/** 固定 Prompt：要求模型只输出严格 JSON（category/color/shape/material/features/text/confidence） */
export const VISION_PROMPT = `你是一个校园失物招领平台的物品识别专家。请分析图片中的失物，只输出一个 JSON 对象。
严格要求：
1. 只输出 JSON 本身，不要输出任何解释、前言、结尾文字，不要用 Markdown 代码块包裹。
2. 必须包含且只包含以下 7 个字段，全部为字符串（confidence 为数字）。
3. 字段值不要换行、不要嵌套对象、不要包含花括号。
字段说明：
- category：物品类别（简短描述，如"黑色水杯""蓝色校园卡"）
- color：主颜色
- shape：形状
- material：材质
- features：外观特征（一句话，不含花括号）
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

/** 从模型输出中提取并解析 JSON（容忍 ```json 围栏、前后杂文、多段输出） */
export function extractJson(text) {
  const cleaned = String(text || '')
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();

  // 优先：括号配对扫描，提取第一个「完整且能解析」的 JSON 对象。
  // 正确跳过字符串字面量内的花括号，避免 features 等字段含 } 时误截断。
  const start = cleaned.indexOf('{');
  if (start !== -1) {
    let depth = 0;
    let inStr = false;
    let escaped = false;
    for (let i = start; i < cleaned.length; i++) {
      const ch = cleaned[i];
      if (inStr) {
        if (escaped) escaped = false;
        else if (ch === '\\') escaped = true;
        else if (ch === '"') inStr = false;
        continue;
      }
      if (ch === '"') inStr = true;
      else if (ch === '{') depth++;
      else if (ch === '}') {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(cleaned.slice(start, i + 1));
          } catch {
            break; // 配对成功但解析失败，退回宽松法
          }
        }
      }
    }
  }

  // 回退：取首个 { 到最后一个 } 之间宽松解析
  const s = cleaned.indexOf('{');
  const e = cleaned.lastIndexOf('}');
  if (s === -1 || e === -1 || e <= s) {
    throw new Error('模型输出中未找到 JSON 对象');
  }
  return JSON.parse(cleaned.slice(s, e + 1));
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