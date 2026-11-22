import { useCallback, useEffect, useState } from 'react';
import { formatCents } from '../../lib/money';

const RANGES = [
  { id: 'today', label: 'Today' },
  { id: '7d', label: '7 days' },
  { id: '30d', label: '30 days' },
  { id: '90d', label: '90 days' },
];

const METHOD_LABELS = { cash_app: 'Cash App', zelle: 'Zelle' };
const SOURCE_LABELS = { online: 'Online', staff: 'Taken by staff' };

function Stat({ label, value, note }) {
  return (
    <div className="sales-stat">
      <span className="sales-stat-label">{label}</span>
      <strong className="sales-stat-value">{value}</strong>
      {note && <span className="sales-stat-note">{note}</span>}
    </div>
  );
}

/** Split of paid sales by a key (payment method, source), as bars. */
function Split({ title, data, labels }) {
  const rows = Object.entries(data || {});
  const total = rows.reduce((n, [, v]) => n + v.cents, 0);
  if (!rows.length) return null;
  return (
    <section className="sales-card">
      <h3>{title}</h3>
      <ul className="sales-bars">
        {rows.map(([key, v]) => (
          <li key={key}>
            <span className="sales-bar-label">{labels[key] || key}</span>
            <span className="sales-bar" aria-hidden="true"><span style={{ width: `${total ? (v.cents / total) * 100 : 0}%` }} /></span>
            <span className="sales-bar-value">{formatCents(v.cents)} · {v.orders}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Owner dashboard: what the online ordering system is bringing in. Counts
 * paid orders (verified payments), by when they were paid.
 */
export default function SalesDashboard({ request }) {
  const [range, setRange] = useState('7d');
  const [state, setState] = useState({ status: 'loading', data: null, error: '' });

  const load = useCallback(async () => {
    setState((s) => ({ ...s, status: s.data ? 'refreshing' : 'loading', error: '' }));
    try {
      const data = await request(`/api/staff/stats?range=${range}`);
      setState({ status: 'ready', data, error: '' });
    } catch (err) {
      setState({ status: 'error', data: null, error: err.message });
    }
  }, [range, request]);

  useEffect(() => {
    load();
  }, [load]);

  const s = state.data?.summary;
  const days = s?.byDay || [];
  const maxDay = Math.max(1, ...days.map((d) => d.cents));
  const returning = s ? Math.max(0, s.customers - s.newCustomers) : 0;

  return (
    <div className="sales">
      <div className="sales-head">
        <div className="sales-ranges" role="group" aria-label="Date range">
          {RANGES.map((r) => (
            <button key={r.id} type="button" className={`pay-switch-btn${range === r.id ? ' is-active is-range' : ''}`} aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
        </div>
        <button type="button" className="btn btn-outline btn-sm" onClick={load}>Refresh</button>
      </div>

      {state.status === 'loading' && <p role="status">Loading sales…</p>}
      {state.status === 'error' && <p className="notice notice-error" role="alert">{state.error}</p>}

      {s && (
        <>
          <div className="sales-stats">
            <Stat label="Sales" value={formatCents(s.salesCents)} note={`incl. ${formatCents(s.taxCents)} sales tax`} />
            <Stat label="Paid orders" value={s.paidOrders} note={`${s.ordersPlaced} placed · ${s.cancelledOrders} cancelled`} />
            <Stat label="Average order" value={formatCents(s.avgTicketCents)} />
            <Stat label="Customers" value={s.customers} note={`${s.newCustomers} new · ${returning} returning`} />
            <Stat label="Waiting on payment" value={s.awaitingPayment} note="right now" />
            {s.rewardsRedeemed > 0 && <Stat label="Rewards redeemed" value={s.rewardsRedeemed} />}
          </div>

          {days.length > 1 && (
            <section className="sales-card">
              <h3>Sales by day</h3>
              <ul className="sales-days">
                {days.map((d) => (
                  <li key={d.day} title={`${d.day}: ${formatCents(d.cents)} · ${d.orders} orders`}>
                    <span className="sales-day-bar" style={{ height: `${Math.max(4, (d.cents / maxDay) * 100)}%` }} />
                    <span className="sales-day-label">{new Date(`${d.day}T12:00:00`).toLocaleDateString([], { month: 'numeric', day: 'numeric' })}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="sales-grid">
            <section className="sales-card">
              <h3>Top items</h3>
              {s.topItems.length === 0 ? (
                <p className="cart-empty">No paid orders in this range yet.</p>
              ) : (
                <ol className="sales-top">
                  {s.topItems.map((i) => (
                    <li key={i.name}>
                      <span>{i.name}</span>
                      <span>{i.quantity} sold · {formatCents(i.cents)}</span>
                    </li>
                  ))}
                </ol>
              )}
            </section>
            <div>
              <Split title="How customers paid" data={s.byMethod} labels={METHOD_LABELS} />
              <Split title="Where orders came from" data={s.bySource} labels={SOURCE_LABELS} />
            </div>
          </div>
          <p className="sales-note">Sales count orders once payment is verified, on the day it was verified ({state.data.timezone}).</p>
        </>
      )}
    </div>
  );
}
