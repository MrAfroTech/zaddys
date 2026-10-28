import { useCallback, useEffect, useState } from 'react';
import OrderLines from '../components/order/OrderLines';
import PaymentStatus from '../components/order/PaymentStatus';
import PaymentInstructions from '../components/order/PaymentInstructions';
import { apiRequest } from '../lib/api';
import { restaurant } from '../data/restaurant';

const REFRESH_MS = 30_000;

/** /order/status/<ref> — read-only view of one order for the customer. */
export default function OrderStatusPage({ statusRef }) {
  const [state, setState] = useState({ status: 'loading', order: null, error: '' });
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    document.title = 'Your order | Zaddys Subs & Deli Shop';
  }, []);

  const load = useCallback(async () => {
    setChecking(true);
    try {
      const data = await apiRequest('/api/order-status', { method: 'POST', body: { ref: statusRef } });
      setState({ status: 'ready', order: data.order, error: '' });
    } catch (err) {
      setState((s) => ({ status: s.order ? 'ready' : 'error', order: s.order, error: err.message }));
    } finally {
      setChecking(false);
    }
  }, [statusRef]);

  useEffect(() => {
    load();
  }, [load]);

  const awaiting = state.order && ['pending', 'manual_review'].includes(state.order.paymentStatus) && state.order.orderStatus === 'open';

  // Keep checking while payment is outstanding (e.g. after returning from Cash App or the bank app).
  useEffect(() => {
    if (!awaiting) return undefined;
    const id = window.setInterval(load, REFRESH_MS);
    return () => window.clearInterval(id);
  }, [awaiting, load]);

  const { order } = state;

  return (
    <section className="section order-status" aria-labelledby="status-title">
      <div className="container order-status-inner">
        <p className="eyebrow">Your order</p>
        {state.status === 'loading' && <p role="status">Loading your order…</p>}
        {state.status === 'error' && (
          <>
            <h1 id="status-title" className="section-title">Order not found</h1>
            <p className="notice notice-error" role="alert">{state.error}</p>
            <p>Questions? Call <a href={restaurant.phoneHref}>{restaurant.phone}</a>.</p>
          </>
        )}
        {order && (
          <>
            <h1 id="status-title" className="section-title">Order {order.orderNumber}</h1>
            <p className="order-status-thanks">Thanks, {order.customerFirstName}. Keep this page bookmarked to check your order.</p>
            <PaymentStatus status={order.paymentStatus} orderStatus={order.orderStatus} />
            {awaiting && (
              <p className="notice">
                Paid already? Your order stays “awaiting payment confirmation” until our staff find your payment in
                our Cash App or Zelle account. You don’t need to send a screenshot. This page checks for updates automatically.
              </p>
            )}
            {order.paymentInstructions && <PaymentInstructions instructions={order.paymentInstructions} />}
            <h2 className="order-status-sub">Items</h2>
            <OrderLines order={order} />
            {order.pricingNote && <p className="order-status-note">{order.pricingNote}</p>}
            {state.error && <p className="field-error" role="alert">{state.error}</p>}
            <div className="btn-row">
              <button type="button" className="btn btn-outline" onClick={load} disabled={checking}>
                {checking ? 'Checking…' : 'Check status'}
              </button>
              <a className="btn btn-outline" href={restaurant.phoneHref}>Call {restaurant.phone}</a>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
