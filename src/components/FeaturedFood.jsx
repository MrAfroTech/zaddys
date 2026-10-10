import { featuredItems } from '../data/featured';
import { photos } from '../data/photos';
import Placeholder from './Placeholder';

export default function FeaturedFood() {
  const { featured } = photos;
  return (
    <section className="section featured" aria-labelledby="featured-title">
      <div className="container featured-layout">
        <div className="featured-media">
          {featured.src ? (
            <img src={featured.src} alt={featured.alt} loading="lazy" className="featured-img" />
          ) : (
            <Placeholder label={featured.label} className="featured-img" />
          )}
        </div>
        <div className="featured-body">
          <p className="eyebrow">From the deli</p>
          <h2 id="featured-title" className="section-title">Try these first</h2>
          <ul className="featured-list">
            {featuredItems.map((item) => (
              <li key={item.name}>
                <span className="featured-name">{item.name}</span>
                {item.availability && <span className="pill">{item.availability}</span>}
                {item.price && <span className="featured-price">{item.price}</span>}
              </li>
            ))}
          </ul>
          <a href="/menu" className="btn btn-primary">See the menu</a>
        </div>
      </div>
    </section>
  );
}
