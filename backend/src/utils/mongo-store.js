import { getDb } from './mongo-client.js';

/**
 * MongoDB 版通用存储：与 json-store 的 createStore 保持相同契约（read / write / update），
 * 使上层 service 无需改动即可从「JSON 文件」切换到「MongoDB」。
 *
 * 映射策略（最小改造）：每个 store = stores 集合中的一个文档
 *   { _id: <storeKey>, data: <整个集合对象>, rev: <乐观锁版本号>, updatedAt }
 * 例如 lost_items.json({items:[]}) → { _id:'lost_items', data:{items:[...]}, rev:N }
 *
 * 并发控制：
 *   - update 沿用「进程内串行队列」，防止单进程内并发写互相覆盖（与 json 版一致）；
 *   - 额外用 rev 乐观锁写回（replaceOne 带 rev 条件），命中冲突时自动重读重试，
 *     兜住多实例/异常时序下的丢写。
 */

const COLLECTION = 'stores';

export function createStore(filename, defaults) {
  // lost_items.json → lost_items
  const storeKey = filename.replace(/\.json$/i, '');
  let queue = Promise.resolve();

  async function coll() {
    const db = await getDb();
    return db.collection(COLLECTION);
  }

  /** 读取整个集合对象；文档不存在时返回 defaults 的深拷贝 */
  async function read() {
    const c = await coll();
    const doc = await c.findOne({ _id: storeKey });
    if (!doc || doc.data === undefined || doc.data === null) {
      return structuredClone(defaults);
    }
    return doc.data;
  }

  /** 读取时连带取回当前 rev（供乐观锁写回使用） */
  async function readWithRev() {
    const c = await coll();
    const doc = await c.findOne({ _id: storeKey });
    if (!doc || doc.data === undefined || doc.data === null) {
      return { data: structuredClone(defaults), rev: 0 };
    }
    return { data: doc.data, rev: typeof doc.rev === 'number' ? doc.rev : 0 };
  }

  /** 覆盖写整个集合对象（upsert）。用于全量写，rev 自增。 */
  async function write(data) {
    const c = await coll();
    const current = await c.findOne({ _id: storeKey }, { projection: { rev: 1 } });
    const nextRev = (current && typeof current.rev === 'number' ? current.rev : 0) + 1;
    await c.replaceOne(
      { _id: storeKey },
      { _id: storeKey, data, rev: nextRev, updatedAt: new Date() },
      { upsert: true }
    );
  }

  /**
   * 读 → mutator 改 → 带 rev 条件写回。
   * 串行队列保证单进程内顺序执行；rev 冲突时最多重试若干次。
   */
  function update(mutator) {
    const task = queue.then(async () => {
      const MAX_RETRY = 5;
      for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
        const { data, rev } = await readWithRev();
        const next = await mutator(data);
        const c = await coll();
        // 仅当 rev 未被其他写入改变时才落库
        try {
          const res = await c.replaceOne(
            { _id: storeKey, rev },
            { _id: storeKey, data: next, rev: rev + 1, updatedAt: new Date() },
            { upsert: rev === 0 } // rev=0 表示文档可能尚不存在，允许 upsert
          );
          if (res.matchedCount > 0 || res.upsertedCount > 0) {
            return next;
          }
        } catch (err) {
          // 并发首次创建时可能撞 _id 唯一键（11000）：交给下一轮重读重试
          if (err && err.code === 11000) continue;
          throw err;
        }
        // 未命中：说明 rev 已被其他写入推进，重读重试
      }
      throw new Error(`[mongo-store] ${storeKey} 写入冲突重试超限`);
    });
    queue = task.catch(() => {});
    return task;
  }

  return { read, write, update };
}
