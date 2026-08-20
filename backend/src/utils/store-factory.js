import { createStore as createJsonStore } from './json-store.js';
import { createStore as createMongoStore } from './mongo-store.js';

/**
 * 存储驱动工厂：按环境变量 DB_DRIVER 选择底层实现。
 *   DB_DRIVER=json （默认）→ 本地 JSON 文件（json-store）
 *   DB_DRIVER=mongo        → MongoDB Atlas（mongo-store）
 * 两种实现暴露相同的 { read, write, update } 契约，上层 service 无感知。
 * 出问题时把 DB_DRIVER 切回 json 重新部署即可秒回退。
 */
export function getDbDriver() {
  return (process.env.DB_DRIVER || 'json').toLowerCase();
}

export function createStore(filename, defaults) {
  return getDbDriver() === 'mongo'
    ? createMongoStore(filename, defaults)
    : createJsonStore(filename, defaults);
}
