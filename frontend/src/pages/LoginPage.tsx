import { useState } from 'react';
import { Spinner } from '../components/LoadingSpinner';
import { useToast } from '../components/Toast';
import { api } from '../lib/api';
import { navigate } from '../lib/router';
import { saveAuth } from '../lib/user';

type Mode = 'login' | 'register';

const DEMO_ACCOUNTS = [
  { username: 'userA', password: '123456', label: '用户A · 拾取者' },
  { username: 'userB', password: '123456', label: '用户B · 失主' }
];

export default function LoginPage({ hint }: { hint?: string }) {
  const { show } = useToast();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    const name = username.trim();
    if (!name || !password) {
      setError('请输入用户名和密码');
      return;
    }
    if (mode === 'register') {
      if (password !== confirmPassword) {
        setError('两次输入的密码不一致');
        return;
      }
      if (password.length < 6) {
        setError('密码至少 6 位');
        return;
      }
    }
    setError('');
    setLoading(true);
    try {
      if (mode === 'register') {
        await api.register({ username: name, password, confirmPassword });
        show('注册成功，正在登录…');
      }
      const { token, user } = await api.login({ username: name, password });
      saveAuth(token, user);
      show(`欢迎，${user.displayName}`);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '操作失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-up mx-auto max-w-md">
      {hint && (
        <p className="mb-4 rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-700">🔒 {hint}</p>
      )}

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="px-6 pt-8 text-center">
          <span
            className="mx-auto grid h-14 w-14 place-items-center rounded-2xl text-2xl text-white shadow-md"
            style={{ background: 'linear-gradient(135deg,#2563eb,#06b6d4)' }}
          >
            🔍
          </span>
          <h1 className="mt-4 text-xl font-bold text-slate-800">欢迎使用 AI寻物宝</h1>
          <p className="mt-1 text-sm text-slate-500">{mode === 'login' ? '登录后即可发布失物、申请认领' : '注册一个账号开始使用'}</p>
        </div>

        <div className="mt-6 flex gap-2 px-6">
          {(['login', 'register'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => {
                setMode(m);
                setError('');
              }}
              className={`flex-1 rounded-full py-2 text-sm font-medium transition ${
                mode === m ? 'text-white shadow-md' : 'border border-slate-200 bg-white text-slate-600'
              }`}
              style={mode === m ? { background: 'linear-gradient(135deg,#2563eb,#06b6d4)' } : undefined}
            >
              {m === 'login' ? '登录' : '注册'}
            </button>
          ))}
        </div>

        <div className="space-y-4 px-6 py-6">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">用户名</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="2-20 位字母、数字或中文"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? '至少 6 位' : '请输入密码'}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
            />
          </div>
          {mode === 'register' && (
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">确认密码</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="再次输入密码"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-100"
              />
            </div>
          )}

          {error && <p className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>}

          <button
            type="button"
            disabled={loading}
            onClick={() => void submit()}
            className="btn-gradient flex w-full items-center justify-center gap-2 rounded-xl py-3 font-semibold text-white shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <Spinner size={18} className="text-white" /> : mode === 'login' ? '登 录' : '注册并登录'}
          </button>
        </div>

        <div className="border-t border-slate-100 bg-slate-50/60 px-6 py-4">
          <p className="text-xs font-medium text-slate-500">演示账号（点击快速填入，管理员需手动登录）</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.username}
                type="button"
                onClick={() => {
                  setMode('login');
                  setUsername(acc.username);
                  setPassword(acc.password);
                  setConfirmPassword('');
                  setError('');
                }}
                className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-blue-300 hover:text-blue-600"
              >
                {acc.label}（{acc.username}）
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}