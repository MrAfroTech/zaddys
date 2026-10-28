import { useCallback, useEffect, useRef, useState } from 'react';
import MenuItemCard from '../components/order/MenuItemCard';
import { groupByCategory } from '../lib/menuGroups';
import CartPanel from '../components/order/CartPanel';
import CustomerFields, { validateCustomer } from '../components/order/CustomerFields';
import PaymentMethodPicker from '../components/order/PaymentMethodPicker';
import { apiRequest, newRequestKey } from '../lib/api';
import { CART_LIMITS, useCart } from '../lib/useCart';
import { formatCents } from '../lib/money';
import { restaurant } from '../data/restaurant';

const KEY_STORAGE = 'zaddys-checkout-key';

/**
 * One request key per distinct checkout payload, kept in sessionStorage so a
 * refresh or retry of the same submission reuses it (server returns the same
 * order). Changing the cart or details starts a new key.
 */
function requestKeyFor(payload) {
  const body = JSON.stringify(payload);
  try {
    const saved = JSON.parse(window.sessionStorage.getItem(KEY_STORAGE) || 'null');
    if (saved && saved.body === body) return saved.key;
  } catch {
    /* ignore */
  }
  const key = newRequestKey();
  try {
    window.sessionStorage.setItem(KEY_STORAGE, JSON.stringify({ body, key }));
  } catch {
    /* ignore */
  }
  return key;
}

export default function OrderPage() {
  const [menu, setMenu] = useState({ status: 'loading', items: [], enabled: false, methods: [], error: '' });
  const [paymentMethod, setPaymentMethod] = useState('');
  const [step, setStep] = useState('menu');
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const headingRef = useRef(null);
  const cart = useCart('zaddys-cart', menu.items, CART_LIMITS.online);
  const limitNote = `Online orders are limited to ${CART_LIMITS.online.maxQty} of an item, ${CART_LIMITS.online.maxItems} items and ${formatCents(CART_LIMITS.online.maxTotalCents)} before tax. For a bigger order, please call ${restaurant.phone}.`;

  useEffect(() => {
    document.title = 'Order online | Zaddys Subs & Deli Shop';
  }, []);

  const loadMenu = useCallback(async () => {
    setMenu((m) => ({ ...m, status: 'loading', error: '' }));
    try {
      const data = await apiRequest('/api/menu');
      setMenu({ status: 'ready', items: data.items, enabled: data.onlineOrderingEnabled, methods: data.paymentMethods || [], taxRateBp: data.salesTaxRateBp || 0, taxLabel: data.salesTaxLabel || '', error: '' });
      setPaymentMethod((cur) => cur || (data.paymentMethods?.length === 1 ? data.paymentMethods[0].id : ''));
    } catch (err) {
      setMenu((m) => ({ ...m, status: 'error', error: err.message }));
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const hasDemo = menu.items.some((i) => i.isDemo);
  const canCheckout = menu.enabled && menu.methods.length > 0 && cart.lines.length > 0 && !cart.hasUnavailable && !cart.overLimit;

  async function submit(e) {
    e.preventDefault();
    setSubmitError('');
    const found = validateCustomer(customer);
    if (!paymentMethod) found.paymentMethod = 'Choose how you will pay.';
    setErrors(found);
    if (Object.keys(found).length) return;
    if (!canCheckout) return;

    const payload = {
      customer: { name: customer.name.trim(), phone: customer.phone.trim(), email: customer.email.trim() },
      paymentMethod,
      items: cart.lines.map((l) => ({ menuItemId: l.id, quantity: l.quantity })),
    };
    setSubmitting(true);
    try {
      const data = await apiRequest('/api/orders', {
        method: 'POST',
        body: { ...payload, idempotencyKey: requestKeyFor(payload) },
      });
      cart.clear();
      try {
        window.sessionStorage.removeItem(KEY_STORAGE);
      } catch {
        /* ignore */
      }
      window.location.assign(data.statusPath);
    } catch (err) {
      setSubmitting(false);
      setErrors(err.fields || {});
      setSubmitError(err.message);
      if (err.code === 'item_unavailable') {
        loadMenu();
        setStep('menu');
      }
    }
  }

  return (
    <section className="section order-page" aria-labelledby="order-title">
      <div className="container">
        <p className="eyebrow">Order online</p>
        <h1 id="order-title" className="section-title" tabIndex={-1} ref={headingRef}>
          {step === 'menu' ? 'Order online' : 'Checkout'}
        </h1>

        {hasDemo && (
          <p className="notice notice-demo">
            <strong>Preview:</strong> these are demonstration items and prices, not the Zaddys menu. They need
            restaurant approval before going live.
          </p>
        )}
        {menu.status === 'ready' && !menu.enabled && (
          <p className="notice">
            Online ordering is not open yet. To order now, call{' '}
            <a href={restaurant.phoneHref}>{restaurant.phone}</a>.
          </p>
        )}

        {menu.status === 'loading' && <p className="order-loading" role="status">Loading the menu…</p>}
        {menu.status === 'error' && (
          <div className="notice notice-error" role="alert">
            <p>{menu.error}</p>
            <button type="button" className="btn btn-outline" onClick={loadMenu}>Try again</button>
          </div>
        )}

        {menu.status === 'ready' && (
          <div className="order-layout">
            {step === 'menu' ? (
              <div className="order-menu-groups">
                {groupByCategory(menu.items).map((group) => (
                  <section key={group.name} className="order-menu-group" aria-label={group.name}>
                    <h2 className="order-menu-group-title">{group.name}</h2>
                    <ul className="order-menu">
                      {group.items.map((item) => (
                        <MenuItemCard
                          key={item.id}
                          item={item}
                          orderingOpen={menu.enabled}
                          quantityInCart={cart.lines.find((l) => l.id === item.id)?.quantity || 0}
                          onAdd={cart.add}
                        />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            ) : (
              <form className="checkout" onSubmit={submit} noValidate>
                <h2 className="checkout-title">Your details</h2>
                <p className="checkout-help">We use these only to reach you about this order.</p>
                <CustomerFields values={customer} onChange={setCustomer} errors={errors} />
                <PaymentMethodPicker methods={menu.methods} value={paymentMethod} onChange={setPaymentMethod} error={errors.paymentMethod} />
                <p className="checkout-pay-note">
                  After you place the order you'll see the exact amount and who to pay.
                </p>
                {errors.items && <p className="field-error" role="alert">{errors.items}</p>}
                {submitError && <p className="notice notice-error" role="alert">{submitError}</p>}
                <div className="btn-row">
                  <button type="submit" className="btn btn-primary btn-lg" disabled={submitting || !canCheckout}>
                    {submitting ? 'Placing order…' : 'Place order'}
                  </button>
                  <button type="button" className="btn btn-outline btn-lg" onClick={() => setStep('menu')} disabled={submitting}>
                    Back to menu
                  </button>
                </div>
              </form>
            )}

            <CartPanel cart={cart} limitNote={limitNote} taxRateBp={menu.taxRateBp} taxLabel={menu.taxLabel}>
              {step === 'menu' && (
                <button
                  type="button"
                  className="btn btn-primary btn-block"
                  onClick={() => setStep('checkout')}
                  disabled={!canCheckout}
                >
                  Continue to checkout
                </button>
              )}
              {cart.hasUnavailable && (
                <p className="field-error">Remove unavailable items to continue.</p>
              )}
              <p className="cart-note cart-limits">{limitNote}</p>
            </CartPanel>
          </div>
        )}
      </div>
    </section>
  );
}
