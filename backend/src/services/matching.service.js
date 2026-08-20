import { readDb } from '../db.js';
import { ITEM_STATUS, toPublicItem } from './item.service.js';
import { recognizeImage } from './ai/ai.service.js';

/**
 * 扫图找失物 —— 失主上传物品图片，AI 提取特征后与现有公开失物做结构化匹配
 * （第一版，不引入向量数据库；评分可解释、稳定、易调试）
 *
 * 匹配评分设计：
 *   物品类型 30 分（完全一致 30 / 互相包含或 AI 标签一致 20）
 *   颜色     25 分（完全一致 25 / 互相包含 15）
 *   形状     15 分（完全一致 15 / 互相包含 10）
 *   材质      5 分（完全一致 5）
 *   外观特征 15 分（按关键词命中比例给分）
 *   可识别文字 10 分（非"无"且出现在失物描述/特征中）
 *   总分 100；低于 MATCH_MIN_SCORE(35) 视为不匹配，不返回
 */
export const MATCH_WEIGHTS = { type: 30, color: 25, shape: 15, material: 5, feature: 15, text: 10 };
export const MATCH_MIN_SCORE = 35;
export const MATCH_MAX_RESULTS = 8;

function norm(s) {
  return String(s || '').trim().toLowerCase();
}

/** 字符串相似：完全相等 1；互相包含 0.6；否则 0 */
function similarity(a, b) {
  const x = norm(a);
  const y = norm(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  if (x.includes(y) || y.includes(x)) return 0.6;
  return 0;
}

/** 特征关键词命中比例：把 AI 特征按常见分隔符拆词，计算出现在失物特征/描述中的比例 */
function featureHit(aiFeature, ...targets) {
  const kws = norm(aiFeature).split(/[、，,;；/| 　]+/).filter(Boolean);
  if (kws.length === 0) return 0;
  const text = targets.map(norm).join(' ');
  if (!text) return 0;
  let hit = 0;
  for (const k of kws) {
    if (k && text.includes(k)) hit += 1;
  }
  return hit / kws.length;
}

/** 可识别文字命中：AI 识别出的文字（非"无"）是否出现在失物特征/描述中 */
function textHit(aiText, ...targets) {
  const t = norm(aiText);
  if (!t || t === '无' || t === 'none') return 0;
  const text = targets.map(norm).join(' ');
  if (!text) return 0;
  // 含空格/逗号时按词匹配，否则整段包含匹配
  const parts = t.split(/[\s,，;；]+/).filter(Boolean);
  return parts.length > 1 ? parts.some((w) => text.includes(w)) : text.includes(t);
}

/**
 * 对单个失物计算匹配分（0-100），返回 { score, matched }
 * matched 为命中的维度名（用于前端展示"为什么匹配"）
 * @param {object} ai  AI 识别特征（type/color/shape/material/feature/text）
 * @param {object} item 失物原始记录（公开字段 + AI 扁平字段）
 */
export function scoreItem(ai, item) {
  const matched = [];
  let score = 0;

  // 1. 物品类型（30）
  const typeSim = Math.max(
    similarity(ai.type, item.type),
    similarity(ai.type, item.category),
    similarity(ai.category, item.type),
    similarity(item.category, ai.type)
  );
  if (typeSim >= 1) {
    score += MATCH_WEIGHTS.type;
    matched.push('类型');
  } else if (typeSim >= 0.6) {
    score += 20;
    matched.push('类型');
  }

  // 2. 颜色（25）
  const colorSim = similarity(ai.color, item.color);
  if (colorSim >= 1) {
    score += MATCH_WEIGHTS.color;
    matched.push('颜色');
  } else if (colorSim >= 0.6) {
    score += 15;
    matched.push('颜色');
  }

  // 3. 形状（15）
  const shapeSim = similarity(ai.shape, item.shape);
  if (shapeSim >= 1) {
    score += MATCH_WEIGHTS.shape;
    matched.push('形状');
  } else if (shapeSim >= 0.6) {
    score += 10;
    matched.push('形状');
  }

  // 4. 材质（5）
  if (similarity(ai.material, item.material) >= 1) {
    score += MATCH_WEIGHTS.material;
    matched.push('材质');
  }

  // 5. 外观特征（15，按关键词命中比例）
  const fh = featureHit(ai.feature, item.features, item.description);
  if (fh > 0) {
    score += Math.round(fh * MATCH_WEIGHTS.feature);
    matched.push('特征');
  }

  // 6. 可识别文字（10）
  if (textHit(ai.text, item.features, item.description)) {
    score += MATCH_WEIGHTS.text;
    matched.push('文字');
  }

  return { score, matched };
}

/**
 * 扫图找失物主流程：图片 → AI 特征提取 → 公开失物匹配 → 按匹配度排序返回候选
 * 返回的候选 item 仅为公开字段（绝不含 place/detailLocation/informationB）
 *
 * @param {{ dataUrl: string }} input
 * @returns {Promise<{ query: object, candidates: Array<{ item, score, matched }> }>}
 */
export async function searchMatchingLostItems({ dataUrl }) {
  // 1. AI 特征提取（复用现有视觉服务链路 recognizeImage，会自动走通义千问；
  //    图片非法或识别失败时向上抛出，由控制器转为友好错误）
  const ai = await recognizeImage({ dataUrl });

  // 2. 遍历公开失物（OPEN/CLAIMING/CLAIMED 参与匹配；已归还/已下架不参与）
  const db = await readDb();
  const rows = [];
  for (const raw of db.items) {
    if (
      raw.status !== ITEM_STATUS.OPEN &&
      raw.status !== ITEM_STATUS.CLAIMING &&
      raw.status !== ITEM_STATUS.CLAIMED
    ) {
      continue;
    }
    const { score, matched } = scoreItem(ai, raw);
    if (score < MATCH_MIN_SCORE) continue;
    rows.push({ pub: toPublicItem(raw), score, matched });
  }

  // 3. 按匹配度降序（同分按发布时间新在前），最多返回 8 条
  rows.sort((a, b) => b.score - a.score || b.pub.createdAt - a.pub.createdAt);
  const candidates = rows.slice(0, MATCH_MAX_RESULTS).map((r) => ({
    item: r.pub,
    score: r.score,
    matched: r.matched
  }));

  // AI 识别出的公开特征摘要（不含 provider/model 等内部信息，供前端展示"AI 识别结果"）
  const query = {
    type: ai.type || '',
    color: ai.color || '',
    shape: ai.shape || '',
    material: ai.material || '',
    features: ai.feature || '',
    text: ai.text || '',
    confidence: ai.confidence ?? null
  };

  return { query, candidates };
}
