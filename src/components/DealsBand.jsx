import { menuSections } from '../data/menu';
import { sectionPhotos } from '../data/photos';
import { ordering, orderLinkProps } from '../data/restaurant';
import Placeholder from './Placeholder';

/** Deals from the flyer, read from the menu data so prices stay in one place. */
export default function DealsBand() {
  const special = menuSections.find((s) => s.id === 'specials')?.items[0];
  const glizzy = menuSections.find((s) => s.id === 'glizzy-deal');
  const { deals } = sectionPhotos;

  return (
    <section id="deals" className="section catering deals" aria-labelledby="deals-title">
      <div className="catering-media">
        {deals.src ? (
          <img src={deals.src} alt={deals.alt} loading="lazy" className="catering-img" />
        ) : (
          <Placeholder label={deals.label} className="catering-img" />
        )}
      </div>
      <div className="catering-body">
        <p className="eyebrow eyebrow-light">Now open</p>
        <h2 id="deals-title" className="display">{glizzy.title}</h2>
        <ul className="deal-list">
          {glizzy.items.map((item) => (
            <li key={item.name}><span>{item.name}</span><span className="deal-price">{item.price}</span></li>
          ))}
        </ul>
        {special && (
          <p className="deal-special">
            <span className="catering-sub">{special.name}</span>
            <span className="deal-price">{special.price}</span>
            {special.availability && <span className="pill">{special.availability}</span>}
          </p>
        )}
        <div className="btn-row">
          <a {...orderLinkProps} className="btn btn-light">{ordering.label}</a>
          <a href="/menu" className="btn btn-outline-light">View menu</a>
        </div>
      </div>
    </section>
  );
}
