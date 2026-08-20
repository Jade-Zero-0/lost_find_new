export type ItemType = '证件' | '电子产品' | '文具' | '衣物' | '水杯' | '钥匙' | '其他';

export type ItemStatus = 'OPEN' | 'CLAIMING' | 'CLAIMED' | 'RESOLVED' | 'CLOSED';

export type ClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface LostItem {
  id: string;
  title: string;
  type: ItemType;
  color: string;
  description: string;
  /** 拾取地点（地点A），仅认领审核通过后展示 */
  place: string;
  /** 图片 dataURL，缺省时使用占位图 */
  image?: string;
  status: ItemStatus;
  createdAt: number;
  owner: string;
}

export interface Claim {
  id: string;
  itemId: string;
  applicant: string;
  note: string;
  status: ClaimStatus;
  createdAt: number;
}
