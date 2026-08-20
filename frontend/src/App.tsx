import { useEffect, useState } from 'react';
import Layout from './components/Layout';
import { PageLoader } from './components/LoadingSpinner';
import { ToastProvider } from './components/Toast';
import { api } from './lib/api';
import { useRoute } from './lib/router';
import { isLoggedIn } from './lib/user';
import HallPage from './pages/HallPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import MyPage from './pages/MyPage';
import PublishPage from './pages/PublishPage';

function renderPage(page: string) {
  switch (page) {
    case '/login':
      return <LoginPage />;
    case '/hall':
      return <HallPage />;
    case '/publish':
      return isLoggedIn() ? <PublishPage /> : <LoginPage hint="请先登录后再发布失物" />;
    case '/my':
      return isLoggedIn() ? <MyPage /> : <LoginPage hint="请先登录后查看我的页面" />;
    case '/':
    case '/home':
    default:
      return <HomePage />;
  }
}

function PageView() {
  const route = useRoute();
  const [page, setPage] = useState(route);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    window.scrollTo({ top: 0 });
    // 页面访问上报（记录网页信息，稳妥方案：后端文件日志）
    void api.logVisit(route).catch(() => {});
    const t = window.setTimeout(() => {
      setPage(route);
      setLoading(false);
    }, 220);
    return () => window.clearTimeout(t);
  }, [route]);

  return (
    <>
      {renderPage(page)}
      {loading && <PageLoader label="页面加载中" />}
    </>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <Layout>
        <PageView />
      </Layout>
    </ToastProvider>
  );
}