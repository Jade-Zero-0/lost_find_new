import type { ClaimStatus, ItemStatus } from '../types';
import { getToken } from './user';
import { apiBase, apiTimeoutMs } from './config';

export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: 'user' | 'admin';
}

export interface AiTags {
  type: string;
  color: string;
  shape: string;
  feature: string;
  /** 材质（智谱 GLM 输出） */
  material?: string;
  /** 可识别文字（智谱 GLM 输出） */
  text?: string;
  /** 识别置信度 0-1 */
  confidence?: number | null;
  /** 识别来源：zhipu / mock */
  provider?: string;
  /** 模型名 */
  model?: string;
}

export interface PublicItem {
  id: string;
  imageUrl: string;
  type: string;
  color: string;
  description: string;
  /** 地点Tips：公开信息，普通用户可见 */
  locationTips?: string;
  /** 详细地点：私有信息，仅发布者/认领通过的申请者可见 */
  detailLocation?: string;
  /** 其他描述/信息B：私有验证信息，仅发布者可见 */
  informationB?: string;
  status: ItemStatus;
  pickerName: string;
  createdAt: number;
  claimCount: number;
  /** AI 详细结果：仅发布者视图返回（公开接口不含） */
  aiTags?: AiTags | null;
  /** AI 分析状态：processing 分析中 / completed 完成 / failed 失败 / none 无 */
  aiStatus?: 'processing' | 'completed' | 'failed' | 'none';
  /** AI 失败原因（仅发布者视图返回） */
  aiError?: string | null;
  /** AI 公开标签：物品类别 */
  category?: string;
  shape?: string;
  material?: string;
  features?: string;
  aiConfidence?: number | null;
  /** 认领闭环字段 */
  claimantId?: string | null;
  claimRequestedAt?: number | null;
  claimApprovedAt?: number | null;
  claimedAt?: number | null;
  returnedAt?: number | null;
}

export interface ClaimInfo {
  id: string;
  itemId: string;
  claimantId: string;
  claimantName: string;
  note: string;
  status: ClaimStatus;
  createdAt: number;
}

export interface PickedItem extends PublicItem {
  place: string;
  detailLocation?: string;
  informationB?: string;
  claims: ClaimInfo[];
}

export interface ClaimedRow {
  item: PublicItem & { place?: string; detailLocation?: string };
  claim: ClaimInfo;
}

export interface PendingClaimItem {
  item: PublicItem & { place: string };
  claims: ClaimInfo[];
}

export interface MyItemsResult {
  pickedItems: PickedItem[];
  claimedItems: ClaimedRow[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), apiTimeoutMs());
  let res: Response;
  try {
    res = await fetch(`${apiBase()}${path}`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      signal: controller.signal,
      ...init
    });
  } catch (err) {
    // 超时 / 网络异常：给用户友好提示，不暴露内部细节
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error('请求超时，请稍后重试');
    }
    throw new Error('网络异常，请检查网络后重试');
  } finally {
    clearTimeout(timer);
  }
  let body: { code: number; data: T; message?: string } | null = null;
  try {
    body = await res.json();
  } catch {
    // 非 JSON 响应
  }
  if (!res.ok || !body || body.code !== 0) {
    throw new Error(body?.message || `请求失败（${res.status}）`);
  }
  return body.data;
}

export const api = {
  register(input: { username: string; password: string; confirmPassword: string }) {
    return request<{ user: AuthUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  login(input: { username: string; password: string }) {
    return request<{ token: string; user: AuthUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  logout() {
    return request<Record<string, never>>('/api/auth/logout', { method: 'POST' });
  },

  me() {
    return request<{ user: AuthUser }>('/api/auth/me');
  },

  upload(input: {
    image: string;
    place: string;
    description: string;
    locationTips?: string;
    detailLocation?: string;
    informationB?: string;
    type?: string;
    color?: string;
  }) {
    return request<{ item: PickedItem }>('/api/upload', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  /** 物品详情（后端按登录身份返回不同字段：公开/发布者/认领通过者） */
  itemDetail(id: string) {
    return request<{ item: PublicItem }>(`/api/items/${id}`);
  },

  /** 申请者确认已领取：物品状态 已认领 → 已归还 */
  confirmReturn(id: string) {
    return request<{ item: PublicItem & { place?: string; detailLocation?: string } }>(
      `/api/items/${id}/confirm-return`,
      { method: 'POST' }
    );
  },

  lostItems() {
    return request<{ items: PublicItem[] }>('/api/lost-items');
  },

  claim(input: { itemId: string; note: string }) {
    return request<{ claim: ClaimInfo }>('/api/claim', {
      method: 'POST',
      body: JSON.stringify(input)
    });
  },

  approve(claimId: string) {
    return request<{ claim: ClaimInfo }>(`/api/claims/${claimId}/approve`, { method: 'POST' });
  },

  reject(claimId: string) {
    return request<{ claim: ClaimInfo }>(`/api/claims/${claimId}/reject`, { method: 'POST' });
  },

  pendingClaims() {
    return request<{ items: PendingClaimItem[] }>('/api/admin/pending-claims');
  },

  myItems() {
    return request<MyItemsResult>('/api/my-items');
  },

  logVisit(page: string) {
    return request<Record<string, never>>('/api/log/visit', {
      method: 'POST',
      body: JSON.stringify({ page })
    });
  }
};