import { menuPrice } from '../data/menu';

/** One menu section. Sized sections show a price per size (6" / 8" / 10"…). */
export default function MenuSection({ section, limit }) {
  const items = limit ? section.items.slice(0, limit) : section.items;
  const more = limit ? section.items.length - items.length : 0;
  const sized = Array.isArray(section.sizes) && section.sizes.length > 1;

  return (
    <div className="menu-section">
      <h3 className="menu-section-title">
        {section.title}
        {section.availability && <span className="pill">{section.availability}</span>}
      </h3>
      {section.subtitle && <p className="menu-section-sub">{section.subtitle}</p>}
      {sized && (
        <p className="menu-sizes" aria-hidden="true">
          {section.sizes.map((s) => <span key={s}>{s}</span>)}
        </p>
      )}
      <ul className="menu-list">
        {items.map((item) => (
          <li key={item.slug || item.name} className={item.addOn ? 'is-addon' : undefined}>
            <span className="menu-item-name">
              {item.name}
              {item.availability && <span className="pill pill-sm">{item.availability}</span>}
              {item.description && <span className="menu-item-desc">{item.description}</span>}
            </span>
            {sized ? (
              <span className="menu-item-prices">
                {item.prices.map((p, i) => (
                  <span key={section.sizes[i]} className="menu-item-price">
                    <span className="sr-only">{section.sizes[i]} </span>{menuPrice(p)}
                  </span>
                ))}
              </span>
            ) : (
              item.prices?.[0] != null && <span className="menu-item-price">{menuPrice(item.prices[0])}</span>
            )}
          </li>
        ))}
      </ul>
      {more > 0 && <p className="menu-more">+ {more} more</p>}
    </div>
  );
}
