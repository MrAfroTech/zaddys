import QuantityStepper from './QuantityStepper';
import { formatCents } from '../../lib/money';
import { estimateTaxCents } from '../../lib/useCart';

/**
 * Cart lines, quantity controls and an estimated subtotal. The final total
 * always comes back from the server when the order is created.
 */
export default function CartPanel({ cart, title = 'Your order', limitNote = '', taxRateBp = 0, taxLabel = '', children }) {
  const taxCents = estimateTaxCents(cart.subtotalCents, taxRateBp);
  return (
    <section className="cart" aria-labelledby="cart-title">
      <h2 id="cart-title" className="cart-title">{title}</h2>
      {cart.lines.length === 0 ? (
        <p className="cart-empty">Your cart is empty. Add something from the menu.</p>
      ) : (
        <>
          <ul className="cart-lines">
            {cart.lines.map((line) => {
              const name = line.item?.name || 'Item no longer on the menu';
              return (
                <li key={line.id} className={`cart-line${line.unavailable ? ' is-unavailable' : ''}`}>
                  <div className="cart-line-main">
                    <span className="cart-line-name">{name}</span>
                    {line.unavailable ? (
                      <span className="cart-line-warning" role="alert">No longer available — please remove it.</span>
                    ) : (
                      <span className="cart-line-each">{formatCents(line.item.priceCents)} each</span>
                    )}
                  </div>
                  <div className="cart-line-controls">
                    {!line.unavailable && (
                      <QuantityStepper value={line.quantity} max={cart.limits.maxQty} itemName={name} onChange={(q) => cart.setQuantity(line.id, q)} />
                    )}
                    <span className="cart-line-total">{line.unavailable ? '—' : formatCents(line.lineTotalCents)}</span>
                    <button type="button" className="btn-link cart-remove" onClick={() => cart.remove(line.id)}>
                      Remove<span className="sr-only"> {name}</span>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
          <dl className="cart-totals">
            <div><dt>Subtotal</dt><dd>{formatCents(cart.subtotalCents)}</dd></div>
            {taxRateBp > 0 && (
              <div className="cart-totals-note"><dt>{taxLabel || 'Sales tax'}</dt><dd>{formatCents(taxCents)}</dd></div>
            )}
            <div><dt>Estimated total</dt><dd>{formatCents(cart.subtotalCents + taxCents)}</dd></div>
          </dl>
          <p className="cart-note">The final total is confirmed when your order is placed.</p>
          {cart.overLimit && <p className="field-error" role="alert">{limitNote || 'This order is over the size limit.'}</p>}
        </>
      )}
      {children}
    </section>
  );
}
