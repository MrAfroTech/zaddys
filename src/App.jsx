import { useEffect } from 'react';
import SiteNav from './components/SiteNav';
import SiteFooter from './components/SiteFooter';
import StickyOrderBar from './components/StickyOrderBar';
import Homepage from './pages/Homepage';
import MenuPage from './pages/MenuPage';
import OrderPage from './pages/OrderPage';
import OrderStatusPage from './pages/OrderStatusPage';
import StaffPage from './pages/StaffPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import TermsOfServicePage from './pages/TermsOfServicePage';

/** Minimal path routing (no react-router), same approach as the Blue Flame site. */
function resolvePage() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/menu') {
    return { page: 'menu' };
  }
  if (path === '/order') {
    return { page: 'order' };
  }
  const status = /^\/order\/status\/([^/]+)$/.exec(path);
  if (status) {
    return { page: 'order-status', statusRef: decodeURIComponent(status[1]) };
  }
  if (path === '/staff') {
    return { page: 'staff' };
  }
  if (path === '/privacy-policy' || path === '/privacy') {
    return { page: 'privacy' };
  }
  if (path === '/terms-of-service' || path === '/terms') {
    return { page: 'terms' };
  }
  return { page: 'home' };
}

// Private pages: keep them out of search results.
const PRIVATE_PAGES = ['order-status', 'staff'];

export default function App() {
  const { page, statusRef } = resolvePage();

  useEffect(() => {
    if (!PRIVATE_PAGES.includes(page)) return;
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
  }, [page]);

  let content = <Homepage />;
  if (page === 'menu') content = <MenuPage />;
  else if (page === 'order') content = <OrderPage />;
  else if (page === 'order-status') content = <OrderStatusPage statusRef={statusRef} />;
  else if (page === 'staff') content = <StaffPage />;
  else if (page === 'privacy') content = <PrivacyPolicyPage />;
  else if (page === 'terms') content = <TermsOfServicePage />;

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <SiteNav page={page} />
      <main id="main">{content}</main>
      <SiteFooter />
      {page !== 'staff' && <StickyOrderBar />}
    </>
  );
}
