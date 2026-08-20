import { logsStore } from '../db.js';

const MAX_LOGS = 1000;

export async function addLog(entry) {
  await logsStore.update((db) => {
    db.logs.unshift({ time: new Date().toISOString(), ...entry });
    if (db.logs.length > MAX_LOGS) db.logs.length = MAX_LOGS;
    return db;
  });
}

export async function getLogs(limit = 200) {
  const db = await logsStore.read();
  return db.logs.slice(0, limit);
}