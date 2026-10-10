import { menuSections } from '../data/menu';
import MenuSection from './MenuSection';

export default function MenuPreview() {
  return (
    <section id="menu" className="section menu-preview" aria-labelledby="menu-title">
      <div className="container">
        <p className="eyebrow">Our menu</p>
        <h2 id="menu-title" className="section-title">Subs, dogs &amp; deli</h2>
        <div className="menu-columns">
          {menuSections.map((s) => (
            <MenuSection key={s.id} section={s} limit={8} />
          ))}
        </div>
        <a href="/menu" className="btn btn-primary">View full menu</a>
      </div>
    </section>
  );
}
