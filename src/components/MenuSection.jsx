export default function MenuSection({ section, limit }) {
  const items = limit ? section.items.slice(0, limit) : section.items;
  const more = limit ? section.items.length - items.length : 0;

  return (
    <div className="menu-section">
      <h3 className="menu-section-title">
        {section.title}
        {section.availability && <span className="pill">{section.availability}</span>}
      </h3>
      <ul className="menu-list">
        {items.map((item) => (
          <li key={item.name}>
            <span className="menu-item-name">{item.name}</span>
            {item.note && <span className="menu-item-note"> ({item.note})</span>}
            {item.availability && <span className="pill pill-sm">{item.availability}</span>}
            {item.price && <span className="menu-item-price">{item.price}</span>}
          </li>
        ))}
      </ul>
      {more > 0 && <p className="menu-more">+ {more} more</p>}
    </div>
  );
}
