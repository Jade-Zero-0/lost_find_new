import { useEffect } from 'react';
import Layout from './components/Layout';
import { ToastProvider } from './components/Toast';
import { api } from './lib/api';
import { useRoute } from './lib/router';
import { isLoggedIn } from './lib/user';
import DetailPage from './pages/DetailPage';
import HallPage from './pages/HallPage';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import MatchPage from './pages/MatchPage';
import MyPage from './pages/MyPage';
import PublishPage from './pages/PublishPage';
import StatsPage from './pages/StatsPage';

function renderPage(page: string) {
  // 动态路由：物品详情 /items/:id
  const detail = page.match(/^\/items\/([^/]+)$/);
  if (detail) return <DetailPage id={decodeURIComponent(detail[1])} />;

  switch (page) {
    case '/login':
      return <LoginPage />;
    case '/hall':
      return <HallPage />;
    case '/match':
      return <MatchPage />;
    case '/stats':
      return <StatsPage />;
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

  useEffect(() => {
    window.scrollTo({ top: 0 });
    // 页面访问上报（记录网页信息，稳妥方案：后端文件日志）
    void api.logVisit(route).catch(() => {});
  }, [route]);

  return renderPage(route);
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