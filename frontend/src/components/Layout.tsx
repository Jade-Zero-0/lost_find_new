import { useState, type ReactNode } from 'react';
import { Link, useRoute } from '../lib/router';
import { clearAuth, getCurrentUser, isLoggedIn } from '../lib/user';

const NAV = [
  { to: '/', label: '首页', icon: '🏠' },
  { to: '/hall', label: '失物大厅', icon: '🧭' },
  { to: '/publish', label: '发布失物', icon: '📤' },
  { to: '/my', label: '我的', icon: '👤' }
];

export default function Layout({ children }: { children: ReactNode }) {
  const route = useRoute();
  const [open, setOpen] = useState(false);
  const user = getCurrentUser();
  const loggedIn = isLoggedIn();

  const active = (to: string) =>
    to === '/' ? route === '/' || route === '/home' : route.startsWith(to);

  const handleLogout = () => {
    void apiLogout();
  };

  const apiLogout = async () => {
    try {
      const { api } = await import('../lib/api');
      await api.logout();
    } catch {
      // 忽略登出请求失败
    }
    clearAuth();
    window.location.hash = '/';
    window.location.reload();
  };

  const UserBadge = (
    <div className="flex items-center gap-2">
      <span className="hidden items-center gap-1.5 rounded-full bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 sm:inline-flex">
        👤 {user?.displayName}
        {user?.role === 'admin' && (
          <span className="rounded bg-indigo-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">管理员</span>
        )}
      </span>
      {loggedIn ? (
        <button
          type="button"
          onClick={handleLogout}
          className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-600 transition hover:border-rose-300 hover:text-rose-600"
        >
          退出
        </button>
      ) : (
        <Link to="/login" className="btn-gradient rounded-full px-5 py-2 text-sm font-semibold text-white shadow-md">
          登录 / 注册
        </Link>
      )}
    </div>
  );

  return (
    <div className="flex min-h-screen flex-col">
      <header className="glass sticky top-0 z-40 border-b border-slate-200/70 shadow-sm">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex shrink-0 items-center gap-2.5">
            <span
              className="grid h-9 w-9 place-items-center rounded-xl text-lg text-white shadow-md"
              style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)' }}
            >
              🔍
            </span>
            <span className="text-lg font-bold tracking-tight text-slate-800">
              AI寻物宝
              <span className="ml-1.5 hidden text-sm font-medium text-slate-400 sm:inline">校园智能失物招领</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                  active(n.to) ? 'text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'
                }`}
                style={active(n.to) ? { background: 'linear-gradient(135deg,#2563eb,#06b6d4)' } : undefined}
              >
                <span className="mr-1">{n.icon}</span>
                {n.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden md:block">{UserBadge}</div>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-600 md:hidden"
              aria-label="菜单"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                {open ? (
                  <>
                    <path d="M6 6l12 12" />
                    <path d="M18 6L6 18" />
                  </>
                ) : (
                  <>
                    <path d="M4 7h16" />
                    <path d="M4 12h16" />
                    <path d="M4 17h16" />
                  </>
                )}
              </svg>
            </button>
          </div>
        </div>

        {open && (
          <nav className="border-t border-slate-100 bg-white/95 px-4 py-3 md:hidden">
            <div className="flex flex-col gap-1">
              {NAV.map((n) => (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className={`rounded-xl px-4 py-3 text-sm font-medium ${
                    active(n.to) ? 'bg-blue-50 text-blue-600' : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className="mr-2">{n.icon}</span>
                  {n.label}
                </Link>
              ))}
              <div className="mt-2 border-t border-slate-100 pt-3">{UserBadge}</div>
            </div>
          </nav>
        )}
      </header>

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6">{children}</main>

      <footer className="border-t border-slate-200 bg-white/70 py-6 text-center text-sm text-slate-500">
        🔍 AI寻物宝 · 校园智能失物招领平台 —— 让每一件失物都能回家
      </footer>
    </div>
  );
}