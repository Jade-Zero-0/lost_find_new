import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../../database');

/**
 * 通用 JSON 文件存储：read / write / update（串行队列防止并发丢数据）
 */
export function createStore(filename, defaults) {
  const file = path.join(DATA_DIR, filename);
  let queue = Promise.resolve();

  async function read() {
    try {
      const raw = await fs.readFile(file, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      if (err.code === 'ENOENT') return structuredClone(defaults);
      throw err;
    }
  }

  async function write(data) {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.writeFile(file, JSON.stringify(data, null, 2), 'utf-8');
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