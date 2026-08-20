import type { Claim, LostItem } from '../types';
import { mockClaims, mockItems } from '../data/mock';

const ITEMS_KEY = 'alf_items';
const CLAIMS_KEY = 'alf_claims';

function read<T>(key: string): T[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

function write<T>(key: string, value: T[]): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 忽略 localStorage 写入失败（如空间不足）
  }
}

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** 大厅数据 = 演示数据 + 用户发布 */
export function getItems(): LostItem[] {
  return [...mockItems, ...read<LostItem>(ITEMS_KEY)];
}

export function getUserItems(owner: string): LostItem[] {
  return read<LostItem>(ITEMS_KEY).filter((i) => i.owner === owner);
}

export type NewItem = Omit<LostItem, 'id' | 'createdAt' | 'status' | 'owner'>;

export function addItem(data: NewItem): LostItem {
  const item: LostItem = {
    ...data,
    id: uid(),
    createdAt: Date.now(),
    status: 'OPEN',
    owner: '我',
  };
  const list = read<LostItem>(ITEMS_KEY);
  list.unshift(item);
  write(ITEMS_KEY, list);
  return item;
}

export function getClaims(): Claim[] {
  return [...mockClaims, ...read<Claim>(CLAIMS_KEY)];
}

export function getUserClaims(applicant: string): Claim[] {
  return read<Claim>(CLAIMS_KEY).filter((c) => c.applicant === applicant);
}

export function addClaim(itemId: string, note: string): Claim {
  const claim: Claim = {
    id: uid(),
    itemId,
    applicant: '我',
    note,
    status: 'PENDING',
    createdAt: Date.now(),
  };
  const list = read<Claim>(CLAIMS_KEY);
  list.unshift(claim);
  write(CLAIMS_KEY, list);

  const items = read<LostItem>(ITEMS_KEY);
  const target = items.find((i) => i.id === itemId);
  if (target && target.status === 'OPEN') {
    target.status = 'CLAIMING';
    write(ITEMS_KEY, items);
  }
  return claim;
}
