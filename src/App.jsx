import SiteNav from './components/SiteNav';
import SiteFooter from './components/SiteFooter';
import StickyOrderBar from './components/StickyOrderBar';
import Homepage from './pages/Homepage';
import MenuPage from './pages/MenuPage';

/** Minimal path routing (no react-router), same approach as the Blue Flame site. */
function resolvePage() {
  const path = window.location.pathname.replace(/\/+$/, '') || '/';
  if (path === '/menu') {
    return 'menu';
  }
  return 'home';
}

export default function App() {
  const page = resolvePage();
  const content = page === 'menu' ? <MenuPage /> : <Homepage />;

  return (
    <>
      <a href="#main" className="skip-link">Skip to content</a>
      <SiteNav page={page} />
      <main id="main">{content}</main>
      <SiteFooter />
      <StickyOrderBar />
    </>
  );
}
