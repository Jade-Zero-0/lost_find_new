export interface AuthUser {
  id: string;
  username: string;
  displayName: string;
  role: 'user' | 'admin';
}

const TOKEN_KEY = 'alf_token';
const USER_KEY = 'alf_user';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

/** 兼容旧调用：当前登录用户（可能为 null） */
export function getCurrentUser(): AuthUser | null {
  return getStoredUser();
}

export function isLoggedIn(): boolean {
  return !!getToken() && !!getStoredUser();
}

export function isAdmin(): boolean {
  return getStoredUser()?.role === 'admin';
}

export function saveAuth(token: string, user: AuthUser): void {
  try {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  } catch {
    // ignore
  }
}

export function clearAuth(): void {
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  } catch {
    // ignore
  }
}