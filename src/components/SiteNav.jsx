import { useState } from 'react';
import BrandMark from './BrandMark';
import { ordering, orderLinkProps } from '../data/restaurant';

// "Order online" only shows once VITE_ONLINE_ORDERING=true is set for the
// build, so the demo ordering flow isn't linked from the live site by default.
const ONLINE_ORDERING_LINK = import.meta.env.VITE_ONLINE_ORDERING === 'true';

const LINKS = [
  { href: '/menu', label: 'Menu', page: 'menu' },
  { href: '/#deals', label: 'Deals' },
  ...(ONLINE_ORDERING_LINK ? [{ href: '/order', label: 'Order online', page: 'order' }] : []),
  { ...orderLinkProps, label: ordering.label },
  { href: '/#visit', label: 'Visit' },
];

export default function SiteNav({ page }) {
  const [open, setOpen] = useState(false);

  return (
    <header className="site-nav">
      <div className="site-nav-inner">
        <a href="/" className="site-nav-brand" aria-label="Zaddys home">
          <BrandMark />
        </a>
        <button
          type="button"
          className="site-nav-toggle"
          aria-expanded={open}
          aria-controls="site-nav-links"
          onClick={() => setOpen((o) => !o)}
        >
          <span className="sr-only">Menu</span>
          <span className="site-nav-toggle-bars" aria-hidden="true" />
        </button>
        <nav id="site-nav-links" className={`site-nav-links${open ? ' is-open' : ''}`} aria-label="Primary">
          {LINKS.map(({ label, page: linkPage, ...linkProps }) => (
            <a
              key={label}
              {...linkProps}
              className="site-nav-link"
              aria-current={linkPage && linkPage === page ? 'page' : undefined}
              onClick={() => setOpen(false)}
            >
              {label}
            </a>
          ))}
        </nav>
      </div>
    </header>
  );
}
