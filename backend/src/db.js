import { createStore } from './utils/json-store.js';

/** 失物数据（含认领记录） */
export const itemStore = createStore('lost_items.json', { items: [] });
/** 用户账号 */
export const usersStore = createStore('users.json', { users: [] });
/** 登录会话 */
export const sessionsStore = createStore('sessions.json', { sessions: {} });
/** 访问/操作日志 */
export const logsStore = createStore('access_logs.json', { logs: [] });

// 兼容旧接口（失物存储）
export const readDb = itemStore.read;
export const writeDb = itemStore.write;
export const updateDb = itemStore.update;