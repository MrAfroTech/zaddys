import { useCallback, useEffect, useState } from 'react';
import MenuItemCard from '../components/order/MenuItemCard';
import CartPanel from '../components/order/CartPanel';
import CustomerFields, { validateCustomer } from '../components/order/CustomerFields';
import PaymentMethodPicker from '../components/order/PaymentMethodPicker';
import OrderLines from '../components/order/OrderLines';
import PaymentInstructions from '../components/order/PaymentInstructions';
import { paymentStatusLabel } from '../components/order/PaymentStatus';
import { apiRequest, newRequestKey } from '../lib/api';
import { CART_LIMITS, useCart } from '../lib/useCart';
import { formatCents, parseDollarsToCents } from '../lib/money';
import { getAccessToken, staffAuthConfigured, supabase } from '../lib/staffAuth';

const TABS = [
  { id: 'new', label: 'New order' },
  { id: 'awaiting', label: 'Awaiting payment' },
  { id: 'paid', label: 'Paid & open' },
  { id: 'recent', label: 'Recent' },
];

async function staffRequest(path, options = {}) {
  const token = await getAccessToken();
  return apiRequest(path, { ...options, token });
}

/** /staff — employee tools. Every request is re-checked on the server. */
export default function StaffPage() {
  const [session, setSession] = useState(undefined);
  const [staff, setStaff] = useState(null);
  const [authError, setAuthError] = useState('');
  const [tab, setTab] = useState('new');

  useEffect(() => {
    document.title = 'Staff | Zaddys';
    if (!supabase) return undefined;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session) {
      setStaff(null);
      return;
    }
    staffRequest('/api/staff/me')
      .then((data) => {
        setStaff(data.staff);
        setAuthError('');
      })
      .catch((err) => {
        setStaff(null);
        setAuthError(err.message);
      });
  }, [session]);

  if (!staffAuthConfigured) {
    return (
      <StaffShell>
        <p className="notice">Staff sign-in is not configured yet (VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY).</p>
      </StaffShell>
    );
  }
  if (session === undefined) return <StaffShell><p role="status">Loading…</p></StaffShell>;
  if (!session) return <StaffShell><SignInForm /></StaffShell>;

  return (
    <StaffShell
      right={
        <button type="button" className="btn btn-outline" onClick={() => supabase.auth.signOut()}>
          Sign out
        </button>
      }
    >
      {authError && <p className="notice notice-error" role="alert">{authError}</p>}
      {!staff && !authError && <p role="status">Checking your access…</p>}
      {staff && (
        <>
          <p className="staff-who">Signed in as <strong>{staff.displayName}</strong></p>
          <div className="staff-tabs" role="tablist" aria-label="Staff tools">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`panel-${t.id}`}
                className={`staff-tab${tab === t.id ? ' is-active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            {tab === 'new' ? <NewOrder /> : <OrderList view={tab} key={tab} />}
          </div>
        </>
      )}
    </StaffShell>
  );
}

function StaffShell({ children, right = null }) {
  return (
    <section className="section staff" aria-labelledby="staff-title">
      <div className="container">
        <div className="staff-head">
          <div>
            <p className="eyebrow">Staff only</p>
            <h1 id="staff-title" className="section-title">Orders</h1>
          </div>
          {right}
        </div>
        {children}
      </div>
    </section>
  );
}

function SignInForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (err) setError('Sign-in failed. Check your email and password.');
  }

  return (
    <form className="staff-signin" onSubmit={submit}>
      <div className="field">
        <label htmlFor="staff-email">Email</label>
        <input id="staff-email" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="field">
        <label htmlFor="staff-password">Password</label>
        <input id="staff-password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p className="field-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
    </form>
  );
}

/* ---------------- Employee-assisted ordering ---------------- */

function NewOrder() {
  const [menu, setMenu] = useState({ status: 'loading', items: [], methods: [], error: '' });
  const [paymentMethod, setPaymentMethod] = useState('');
  const cart = useCart('zaddys-staff-cart', menu.items, CART_LIMITS.staff);
  const [customer, setCustomer] = useState({ name: '', phone: '', email: '' });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [busy, setBusy] = useState(false);
  const [requestKey, setRequestKey] = useState({ body: '', key: '' });
  const [created, setCreated] = useState(null);

  const loadMenu = useCallback(async () => {
    try {
      const data = await apiRequest('/api/menu');
      setMenu({ status: 'ready', items: data.items, methods: data.paymentMethods || [], taxRateBp: data.salesTaxRateBp || 0, taxLabel: data.salesTaxLabel || '', error: '' });
    } catch (err) {
      setMenu({ status: 'error', items: [], methods: [], error: err.message });
    }
  }, []);

  useEffect(() => {
    loadMenu();
  }, [loadMenu]);

  async function submit(e) {
    e.preventDefault();
    setSubmitError('');
    const found = validateCustomer(customer);
    if (!paymentMethod) found.paymentMethod = 'Choose how the customer will pay.';
    setErrors(found);
    if (Object.keys(found).length || !cart.lines.length || cart.hasUnavailable || cart.overLimit) return;

    const payload = {
      customer: { name: customer.name.trim(), phone: customer.phone.trim(), email: customer.email.trim() },
      paymentMethod,
      items: cart.lines.map((l) => ({ menuItemId: l.id, quantity: l.quantity })),
    };
    // Same payload -> same key, so a double-click or retry can't create two orders.
    const body = JSON.stringify(payload);
    const key = requestKey.body === body ? requestKey.key : newRequestKey();
    setRequestKey({ body, key });

    setBusy(true);
    try {
      const data = await staffRequest('/api/staff/orders', { method: 'POST', body: { ...payload, idempotencyKey: key } });
      setCreated(data.order);
      cart.clear();
    } catch (err) {
      setErrors(err.fields || {});
      setSubmitError(err.message);
      if (err.code === 'item_unavailable') loadMenu();
    } finally {
      setBusy(false);
    }
  }

  function startAnother() {
    setCreated(null);
    setPaymentMethod('');
    setCustomer({ name: '', phone: '', email: '' });
    setRequestKey({ body: '', key: '' });
    setErrors({});
  }

  if (created) {
    return (
      <div className="staff-created">
        <p className="notice" role="status">
          Order <strong>{created.orderNumber}</strong> created for {created.customer.name} — total{' '}
          <strong>{formatCents(created.totalCents)}</strong>. Payment status: {paymentStatusLabel(created.paymentStatus)}.
        </p>
        <OrderLines order={created} />
        <PaymentInstructions instructions={created.paymentInstructions} forStaff customerPhone={created.customer.phone} />
        <button type="button" className="btn btn-primary" onClick={startAnother}>Start another order</button>
      </div>
    );
  }

  if (menu.status === 'loading') return <p role="status">Loading the menu…</p>;
  if (menu.status === 'error') {
    return (
      <div className="notice notice-error" role="alert">
        <p>{menu.error}</p>
        <button type="button" className="btn btn-outline" onClick={loadMenu}>Try again</button>
      </div>
    );
  }

  return (
    <div className="order-layout">
      <div>
        <ul className="order-menu order-menu-compact" aria-label="Menu items">
          {menu.items.map((item) => (
            <MenuItemCard
              key={item.id}
              item={item}
              compact
              quantityInCart={cart.lines.find((l) => l.id === item.id)?.quantity || 0}
              onAdd={cart.add}
            />
          ))}
        </ul>
        <form className="checkout" onSubmit={submit} noValidate>
          <h2 className="checkout-title">Customer</h2>
          <CustomerFields values={customer} onChange={setCustomer} errors={errors} idPrefix="staff-customer" />
          <PaymentMethodPicker methods={menu.methods} value={paymentMethod} onChange={setPaymentMethod} error={errors.paymentMethod} name="staff-payment-method" />
          {errors.items && <p className="field-error" role="alert">{errors.items}</p>}
          {submitError && <p className="notice notice-error" role="alert">{submitError}</p>}
          <button type="submit" className="btn btn-primary btn-lg" disabled={busy || !cart.lines.length || cart.hasUnavailable || cart.overLimit}>
            {busy ? 'Creating order…' : 'Create order'}
          </button>
        </form>
      </div>
      <CartPanel cart={cart} title="Order" taxRateBp={menu.taxRateBp} taxLabel={menu.taxLabel} limitNote={`Staff orders are limited to ${CART_LIMITS.staff.maxQty} of an item, ${CART_LIMITS.staff.maxItems} items and ${formatCents(CART_LIMITS.staff.maxTotalCents)} before tax.`} />
    </div>
  );
}

/* ---------------- Order lists, verification, status changes ---------------- */

const RESULT_MESSAGES = {
  verified: 'Payment verified. The order is marked paid.',
  amount_mismatch: 'The amount does not match the order total, so the order was moved to manual review. It is not marked paid.',
  already_paid: 'This order is already marked paid. Nothing was changed.',
  already_recorded: 'That transaction is already recorded for this order. Nothing was changed.',
  additional_payment: 'Additional payment recorded and flagged as a possible duplicate payment. No refund was issued.',
};

function OrderList({ view }) {
  const [state, setState] = useState({ status: 'loading', orders: [], error: '' });
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    try {
      const data = await staffRequest(`/api/staff/orders?view=${view}`);
      setState({ status: 'ready', orders: data.orders, error: '' });
    } catch (err) {
      setState((s) => ({ ...s, status: s.orders.length ? 'ready' : 'error', error: err.message }));
    }
  }, [view]);

  useEffect(() => {
    load();
  }, [load]);

  const done = (text) => {
    setMessage(text);
    load();
  };

  if (state.status === 'loading') return <p role="status">Loading orders…</p>;
  if (state.status === 'error') return <p className="notice notice-error" role="alert">{state.error}</p>;

  return (
    <div className="staff-orders">
      <div className="staff-orders-bar">
        <p aria-live="polite" className="staff-message">{message}</p>
        <button type="button" className="btn btn-outline" onClick={load}>Refresh</button>
      </div>
      {state.error && <p className="field-error" role="alert">{state.error}</p>}
      {state.orders.length === 0 && <p className="cart-empty">No orders here.</p>}
      <ul className="staff-order-list">
        {state.orders.map((o) => <StaffOrderCard key={o.id} order={o} onDone={done} />)}
      </ul>
    </div>
  );
}

function StaffOrderCard({ order, onDone }) {
  const [panel, setPanel] = useState(null); // 'verify' | 'additional' | 'cancel' | 'instructions'
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const awaiting = order.orderStatus === 'open' && ['pending', 'manual_review'].includes(order.paymentStatus);
  const paidOpen = order.orderStatus === 'open' && order.paymentStatus === 'paid';

  async function action(name, reason) {
    setBusy(true);
    setError('');
    try {
      await staffRequest('/api/staff/order-actions', { method: 'POST', body: { orderId: order.id, action: name, reason } });
      setPanel(null);
      onDone(`Order ${order.orderNumber} updated.`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <li className="staff-order">
      <div className="staff-order-head">
        <h3>{order.orderNumber}</h3>
        <span className={`pay-badge pay-badge-${order.paymentStatus}`}>{paymentStatusLabel(order.paymentStatus)}</span>
        <span className="pill pill-sm">{order.orderStatus}</span>
        {order.paymentFlag && <span className="pay-flag" role="note">⚠ {order.paymentFlag.replace(/_/g, ' ')}</span>}
      </div>
      <p className="staff-order-meta">
        {new Date(order.createdAt).toLocaleString()} · {order.source === 'staff' ? 'Taken by staff' : 'Online'} ·{' '}
        {order.customer.name} · <a href={`tel:${order.customer.phone.replace(/[^\d+]/g, '')}`}>{order.customer.phone}</a>
      </p>
      <OrderLines order={order} />

      {order.verifications.length > 0 && (
        <details className="staff-verifications">
          <summary>Payment records ({order.verifications.length})</summary>
          <ul>
            {order.verifications.map((v, i) => (
              <li key={i}>
                {v.outcome.replace(/_/g, ' ')} · {formatCents(v.verifiedAmountCents)} seen (expected {formatCents(v.expectedAmountCents)})
                {v.transactionReference && ` · ref ${v.transactionReference}`} · by {v.verifiedBy} on{' '}
                {new Date(v.verifiedAt).toLocaleString()}
                {v.notes && ` · “${v.notes}”`}
              </li>
            ))}
          </ul>
        </details>
      )}

      {error && <p className="field-error" role="alert">{error}</p>}

      <div className="btn-row">
        {awaiting && (
          <>
            <button type="button" className="btn btn-primary" onClick={() => setPanel(panel === 'verify' ? null : 'verify')}>Verify payment</button>
            <button type="button" className="btn btn-outline" onClick={() => setPanel(panel === 'instructions' ? null : 'instructions')}>Payment message</button>
            {order.paymentStatus === 'pending' && (
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => action('manual_review', 'Flagged for review by staff')}>Needs review</button>
            )}
            {order.paymentStatus === 'manual_review' && (
              <button type="button" className="btn btn-outline" disabled={busy} onClick={() => action('return_to_pending', 'Review cleared')}>Back to pending</button>
            )}
          </>
        )}
        {paidOpen && (
          <>
            <button type="button" className="btn btn-primary" disabled={busy} onClick={() => action('complete', null)}>Mark completed</button>
            <button type="button" className="btn btn-outline" onClick={() => setPanel(panel === 'additional' ? null : 'additional')}>Record another payment</button>
          </>
        )}
        {order.orderStatus === 'open' && (
          <button type="button" className="btn btn-outline" onClick={() => setPanel(panel === 'cancel' ? null : 'cancel')}>Cancel order</button>
        )}
      </div>

      {panel === 'instructions' && (
        <PaymentInstructions instructions={order.paymentInstructions} forStaff customerPhone={order.customer.phone} />
      )}
      {(panel === 'verify' || panel === 'additional') && (
        <VerifyPaymentForm order={order} additional={panel === 'additional'} onDone={(text) => { setPanel(null); onDone(text); }} />
      )}
      {panel === 'cancel' && <CancelForm orderId={order.id} busy={busy} paid={order.paymentStatus === 'paid'} onCancel={(reason) => action('cancel', reason)} />}
    </li>
  );
}

function VerifyPaymentForm({ order, additional, onDone }) {
  const [method, setMethod] = useState(order.paymentMethod || 'cash_app');
  const [amount, setAmount] = useState('');
  const [reference, setReference] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const id = `verify-${order.id}`;

  async function submit(e) {
    e.preventDefault();
    setError('');
    const cents = parseDollarsToCents(amount);
    if (cents === null) {
      setError('Enter the amount exactly as shown in Cash App or your bank, e.g. 12.48.');
      return;
    }
    if (!confirmed) {
      setError('Tick the box to confirm you found this payment in the business account yourself.');
      return;
    }
    setBusy(true);
    try {
      const data = await staffRequest('/api/staff/payments', {
        method: 'POST',
        body: {
          orderId: order.id,
          verifiedAmountCents: cents,
          transactionReference: reference,
          notes,
          method,
          confirmedReceived: true,
          additional,
        },
      });
      onDone(`${order.orderNumber}: ${RESULT_MESSAGES[data.result] || 'Recorded.'}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <form className="verify-form" onSubmit={submit} noValidate>
      <h4>{additional ? 'Record another payment' : 'Verify payment'}</h4>
      <p className="verify-help">
        Open the business Cash App account or the business bank’s Zelle activity and find the payment for{' '}
        <strong>{order.orderNumber}</strong> (customer chose {order.paymentMethod === 'zelle' ? 'Zelle' : 'Cash App'}; expected{' '}
        <strong>{formatCents(order.totalCents)}</strong>). Enter what you actually see there. A customer’s screenshot or
        message is not proof of payment.
      </p>
      <div className="fields">
        <div className="field">
          <label htmlFor={`${id}-method`}>Received by</label>
          <select id={`${id}-method`} value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="cash_app">Cash App</option>
            <option value="zelle">Zelle</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor={`${id}-amount`}>Amount received</label>
          <input id={`${id}-amount`} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" required />
        </div>
        <div className="field">
          <label htmlFor={`${id}-ref`}>Transaction ID / confirmation number (if shown)</label>
          <input id={`${id}-ref`} value={reference} onChange={(e) => setReference(e.target.value)} maxLength={120} />
        </div>
        <div className="field">
          <label htmlFor={`${id}-notes`}>Notes (sender name, time, note text)</label>
          <input id={`${id}-notes`} value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} />
        </div>
      </div>
      <label className="check">
        <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        I found this payment in the restaurant’s Cash App or bank (Zelle) account myself.
      </label>
      {error && <p className="field-error" role="alert">{error}</p>}
      <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save verification'}</button>
    </form>
  );
}

function CancelForm({ orderId, onCancel, busy, paid }) {
  const [reason, setReason] = useState('');
  return (
    <form
      className="verify-form"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason.trim()) onCancel(reason.trim());
      }}
    >
      {paid && (
        <p className="notice">
          This order is paid. Cancelling keeps the payment record and flags it; no refund is issued automatically.
        </p>
      )}
      <div className="field">
        <label htmlFor={`cancel-${orderId}`}>Reason for cancelling</label>
        <input id={`cancel-${orderId}`} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} required />
      </div>
      <button type="submit" className="btn btn-outline" disabled={busy || !reason.trim()}>Cancel order</button>
    </form>
  );
}
