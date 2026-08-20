import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { sessionsStore, usersStore } from '../db.js';

const SESSION_TTL = 7 * 24 * 3600 * 1000; // 7 天

function hashPassword(password, salt) {
  const s = salt || randomBytes(16).toString('hex');
  const h = scryptSync(password, s, 32).toString('hex');
  return { salt: s, hash: h };
}

function verifyPassword(password, salt, expectedHash) {
  const h = scryptSync(password, salt, 32);
  const e = Buffer.from(expectedHash, 'hex');
  return h.length === e.length && timingSafeEqual(h, e);
}

export function toPublicUser(u) {
  return { id: u.id, username: u.username, displayName: u.displayName, role: u.role, createdAt: u.createdAt };
}

export async function register({ username, password }) {
  const name = (username || '').trim();
  if (!/^[A-Za-z0-9_\u4e00-\u9fa5]{2,20}$/.test(name)) {
    throw Object.assign(new Error('用户名需为 2-20 位字母、数字、下划线或中文'), { status: 400 });
  }
  if (!password || String(password).length < 6) {
    throw Object.assign(new Error('密码至少 6 位'), { status: 400 });
  }
  let user = null;
  await usersStore.update(async (db) => {
    if (db.users.some((u) => u.username.toLowerCase() === name.toLowerCase())) {
      throw Object.assign(new Error('用户名已存在'), { status: 409 });
    }
    const { salt, hash } = hashPassword(String(password));
    user = {
      id: randomBytes(8).toString('hex'),
      username: name,
      displayName: name,
      passwordSalt: salt,
      passwordHash: hash,
      role: 'user',
      createdAt: Date.now()
    };
    db.users.push(user);
    return db;
  });
  return toPublicUser(user);
}

export async function login({ username, password }) {
  const name = (username || '').trim();
  const db = await usersStore.read();
  const user = db.users.find((u) => u.username.toLowerCase() === name.toLowerCase());
  if (!user || !verifyPassword(String(password || ''), user.passwordSalt, user.passwordHash)) {
    throw Object.assign(new Error('用户名或密码错误'), { status: 401 });
  }
  const token = randomBytes(24).toString('hex');
  await sessionsStore.update((s) => {
    s.sessions[token] = { userId: user.id, expiresAt: Date.now() + SESSION_TTL };
    for (const [k, v] of Object.entries(s.sessions)) {
      if (v.expiresAt < Date.now()) delete s.sessions[k];
    }
    return s;
  });
  return { token, user: toPublicUser(user) };
}

export async function logout(token) {
  if (!token) return;
  await sessionsStore.update((s) => {
    delete s.sessions[token];
    return s;
  });
}

export async function findUserByToken(token) {
  if (!token) return null;
  const s = await sessionsStore.read();
  const session = s.sessions[token];
  if (!session || session.expiresAt < Date.now()) return null;
  const db = await usersStore.read();
  const user = db.users.find((u) => u.id === session.userId);
  return user ? toPublicUser(user) : null;
}
/**
 * 演示账号（用户表为空时自动播种）
 * 安全提示：公网部署时务必通过环境变量 ADMIN_INIT_PASSWORD 设置强密码，
 * 或设置 SEED_DEMO_ACCOUNTS=false 关闭播种（自己注册账号）。
 * 注意：仅当用户表为空时才会播种；改密码后需删除 database/users.json 再重启生效。
 */
function buildSeedAccounts() {
  const adminPassword = process.env.ADMIN_INIT_PASSWORD || 'admin123';
  return [
    { id: 'userA', username: 'userA', displayName: '用户A', password: '123456', role: 'user' },
    { id: 'userB', username: 'userB', displayName: '用户B', password: '123456', role: 'user' },
    { id: 'admin', username: 'admin', displayName: '管理员', password: adminPassword, role: 'admin' }
  ];
}

/** 若用户表为空则写入演示账号；已有用户则跳过 */
export async function ensureSeedUsers() {
  const db = await usersStore.read();
  if (db.users.length > 0) return;
  if ((process.env.SEED_DEMO_ACCOUNTS || 'true').toLowerCase() === 'false') return;
  await usersStore.update((d) => {
    if (d.users.length > 0) return d; // 并发保护
    for (const s of buildSeedAccounts()) {
      const { salt, hash } = hashPassword(s.password);
      d.users.push({
        id: s.id,
        username: s.username,
        displayName: s.displayName,
        passwordSalt: salt,
        passwordHash: hash,
        role: s.role,
        createdAt: Date.now()
      });
    }
    return d;
  });
  console.log('[auth] 已自动创建演示账号: userA / userB / admin（admin 密码来自 ADMIN_INIT_PASSWORD）');
}