import Placeholder from '../Placeholder';
import { formatCents } from '../../lib/money';

export default function MenuItemCard({ item, onAdd, quantityInCart = 0, orderingOpen = true, compact = false }) {
  const canAdd = orderingOpen && item.isAvailable;
  return (
    <li className={`order-item${compact ? ' order-item-compact' : ''}${item.isAvailable ? '' : ' is-unavailable'}`}>
      {!compact && (
        <div className="order-item-media">
          {item.imageUrl ? (
            <img src={item.imageUrl} alt={item.imageAlt || item.name} loading="lazy" />
          ) : (
            <Placeholder label={`${item.name} photo`} className="order-item-placeholder" />
          )}
        </div>
      )}
      <div className="order-item-body">
        <h3 className="order-item-name">
          {item.name}
          {item.isDemo && <span className="pill pill-sm">Demo item</span>}
        </h3>
        {!compact && item.description && <p className="order-item-desc">{item.description}</p>}
        <div className="order-item-foot">
          <span className="order-item-price">{formatCents(item.priceCents)}</span>
          {item.isAvailable ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => onAdd(item.id)}
              disabled={!canAdd}
              aria-label={`Add ${item.name} to order`}
            >
              {quantityInCart > 0 ? `Add another (${quantityInCart})` : 'Add to order'}
            </button>
          ) : (
            <span className="order-item-unavailable">Currently unavailable</span>
          )}
        </div>
      </div>
    </li>
  );
}
