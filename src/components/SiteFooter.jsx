import BrandMark from './BrandMark';
import { restaurant, ordering, orderLinkProps } from '../data/restaurant';
import { groupedHoursRows, hoursKnown } from '../utils/hours';

export default function SiteFooter() {
  const { address } = restaurant;
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div>
          <BrandMark className="footer-brand" />
          <p className="footer-tagline">{restaurant.tagline}</p>
        </div>
        <div>
          <h2 className="footer-heading">Visit</h2>
          <p>{address.street}<br />{address.city}, {address.state} {address.zip}</p>
          <p>
            <a href={restaurant.phoneHref}>{restaurant.phone}</a>
            {restaurant.email && <><br /><a href={`mailto:${restaurant.email}`}>{restaurant.email}</a></>}
          </p>
          {restaurant.social && (
            <p>
              <a href={restaurant.social.instagram} target="_blank" rel="noopener">Instagram</a>
              {' · '}
              <a href={restaurant.social.facebook} target="_blank" rel="noopener">Facebook</a>
              {' · '}@zaddysintampa
            </p>
          )}
        </div>
        <div>
          <h2 className="footer-heading">Hours</h2>
          {hoursKnown
            ? groupedHoursRows().map((h) => <p key={h.days}>{h.days}<br />{h.time}</p>)
            : <p>Call for hours<br /><a href={restaurant.phoneHref}>{restaurant.phone}</a></p>}
        </div>
        <nav aria-label="Footer">
          <h2 className="footer-heading">Explore</h2>
          <ul className="footer-links">
            <li><a href="/menu">Menu</a></li>
            <li><a href="/#deals">Deals</a></li>
            <li><a {...orderLinkProps}>{ordering.label}</a></li>
            <li><a href="/#visit">Visit</a></li>
          </ul>
        </nav>
      </div>
      <p className="footer-legal">© {new Date().getFullYear()} {restaurant.fullName}</p>
    </footer>
  );
}
