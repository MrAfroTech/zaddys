import { useState } from 'react';
import BrandMark from './BrandMark';
import { ordering, orderLinkProps } from '../data/restaurant';

const LINKS = [
  { href: '/menu', label: 'Menu', page: 'menu' },
  { href: '/#deals', label: 'Deals' },
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
