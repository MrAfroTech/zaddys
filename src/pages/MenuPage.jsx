import { useEffect } from 'react';
import { menuSections } from '../data/menu';
import { ordering, orderLinkProps, restaurant } from '../data/restaurant';
import MenuSection from '../components/MenuSection';

export default function MenuPage() {
  useEffect(() => {
    document.title = 'Menu | Zaddys Subs & Deli Shop';
  }, []);

  return (
    <section className="section menu-page" aria-labelledby="menu-page-title">
      <div className="container">
        <p className="eyebrow">Our menu</p>
        <h1 id="menu-page-title" className="section-title">Zaddys menu</h1>
        <nav className="menu-jump" aria-label="Menu sections">
          {menuSections.map((s) => <a key={s.id} href={`#${s.id}`}>{s.title}</a>)}
        </nav>
        <div className="menu-columns menu-columns-full">
          {menuSections.map((s) => (
            <div key={s.id} id={s.id}>
              <MenuSection section={s} />
            </div>
          ))}
        </div>
        <p className="menu-note">
          Prices and availability can change. Call <a href={restaurant.phoneHref}>{restaurant.phone}</a> with questions.
        </p>
        <div className="btn-row">
          <a {...orderLinkProps} className="btn btn-primary btn-lg">{ordering.label}</a>
          <a href="/#deals" className="btn btn-outline btn-lg">See deals</a>
        </div>
      </div>
    </section>
  );
}
