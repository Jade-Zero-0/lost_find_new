import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 数据目录：默认仓库内 database/；
 * 生产环境（如 Render）应通过环境变量 DATA_DIR 指向持久化磁盘
 * （例如 /data/ai-lost-found），否则重新部署/重启会丢失全部数据。
 */
export function getDataDir() {
  return process.env.DATA_DIR
    ? path.resolve(process.env.DATA_DIR)
    : path.resolve(__dirname, '../../../database');
}

/**
 * 通用 JSON 文件存储：read / write / update
 * - update 用 per-store 串行队列防止单进程内并发写互相覆盖
 * - write 采用「写临时文件 + rename」原子替换，避免进程在写一半时被杀导致 JSON 损坏
 */
export function createStore(filename, defaults) {
  let queue = Promise.resolve();

  function file() {
    return path.join(getDataDir(), filename);
  }

  async function read() {
    try {
      const raw = await fs.readFile(file(), 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') return structuredClone(defaults);
      // JSON 解析失败（如上次写入被中断损坏）：不再向上抛导致整个服务雪崩，
      // 而是保留损坏文件副本供排查，并以默认值继续运行
      if (err instanceof SyntaxError) {
        const backup = `${file()}.corrupt-${Date.now()}`;
        try { await fs.copyFile(file(), backup); } catch { /* ignore */ }
        console.error(`[json-store] ${filename} 解析失败，已备份到 ${path.basename(backup)} 并以默认值继续`);
        return structuredClone(defaults);
      }
      throw err;
    }
  }

  async function write(data) {
    const dir = getDataDir();
    await fs.mkdir(dir, { recursive: true });
    // 原子写：先写临时文件，再 rename 覆盖，保证读到的永远是完整 JSON
    const tmp = path.join(dir, `.${filename}.${randomUUID().slice(0, 8)}.tmp`);
    await fs.writeFile(tmp, JSON.stringify(data, null, 2), 'utf-8');
    await fs.rename(tmp, file());
  }

  function update(mutator) {
    const task = queue.then(async () => {
      const data = await read();
      const next = await mutator(data);
      await write(next);
      return next;
    });
    queue = task.catch(() => {});
    return task;
  }

  return { read, write, update };
}
