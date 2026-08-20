import { MongoClient } from 'mongodb';

/**
 * MongoDB 连接单例。
 * - 懒连接：首次 getDb() 时才建立连接，之后全局复用同一个 client。
 * - 通过环境变量配置：
 *     MONGODB_URI  连接串（mongodb+srv://user:pass@cluster.xxx.mongodb.net/...）
 *     MONGODB_DB   数据库名（默认 ai_lost_found）
 * - 提供 connectMongo()（启动时预热）、getDb()（获取库）、closeMongo()（优雅关闭）。
 */

let client = null;
let dbPromise = null;

function getUri() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('未配置 MONGODB_URI（DB_DRIVER=mongo 时必填）');
  }
  return uri;
}

function getDbName() {
  return process.env.MONGODB_DB || 'ai_lost_found';
}

/** 建立（或复用）连接，返回 Db 实例。并发调用只会建一次连接。 */
export function getDb() {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    client = new MongoClient(getUri(), {
      // 免费集群偶发冷启动，给足超时；连接池保持小规模即可
      serverSelectionTimeoutMS: 15_000,
      connectTimeoutMS: 15_000,
      maxPoolSize: 5,
      retryWrites: true
    });
    await client.connect();
    const db = client.db(getDbName());
    // 触发一次 ping，尽早暴露鉴权/网络问题
    await db.command({ ping: 1 });
    console.log(`[mongo] 已连接 Atlas，数据库=${getDbName()}`);
    return db;
  })().catch((err) => {
    // 连接失败：清空 promise 允许后续重试，避免卡在坏连接上
    dbPromise = null;
    client = null;
    throw err;
  });
  return dbPromise;
}

/** 启动时预热连接（可选）；失败会抛出，交由调用方决定是否终止进程。 */
export async function connectMongo() {
  await getDb();
}

/** 优雅关闭连接（进程退出时调用）。 */
export async function closeMongo() {
  if (client) {
    try {
      await client.close();
      console.log('[mongo] 连接已关闭');
    } catch {
      /* ignore */
    }
  }
  client = null;
  dbPromise = null;
}
