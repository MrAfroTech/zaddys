import { ordering, orderLinkProps, restaurant } from '../data/restaurant';

/** Mobile-only sticky bar: ordering is primary, menu and directions beside it. */
export default function StickyOrderBar() {
  return (
    <div className="sticky-order" role="region" aria-label="Quick actions">
      <a href="/menu" className="sticky-order-side">Menu</a>
      <a {...orderLinkProps} className="sticky-order-main">{ordering.label}</a>
      <a href={restaurant.directionsUrl} target="_blank" rel="noopener" className="sticky-order-side">Directions</a>
    </div>
  );
}
