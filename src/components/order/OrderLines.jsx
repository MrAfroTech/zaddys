import { formatCents } from '../../lib/money';

/** Server-calculated order lines and totals. */
export default function OrderLines({ order }) {
  return (
    <div className="order-lines">
      <table>
        <caption className="sr-only">Items in order {order.orderNumber}</caption>
        <thead>
          <tr><th scope="col">Item</th><th scope="col">Qty</th><th scope="col">Each</th><th scope="col">Total</th></tr>
        </thead>
        <tbody>
          {order.items.map((i, idx) => (
            <tr key={`${i.name}-${idx}`}>
              <th scope="row">{i.name}</th>
              <td>{i.quantity}</td>
              <td>{formatCents(i.unitPriceCents)}</td>
              <td>{formatCents(i.lineTotalCents)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr><th scope="row" colSpan={3}>Subtotal</th><td>{formatCents(order.subtotalCents)}</td></tr>
          {order.taxCents > 0 && (
            <tr><th scope="row" colSpan={3}>{order.salesTaxLabel || 'Sales tax'}</th><td>{formatCents(order.taxCents)}</td></tr>
          )}
          {order.feesCents > 0 && (
            <tr><th scope="row" colSpan={3}>Fees</th><td>{formatCents(order.feesCents)}</td></tr>
          )}
          <tr className="order-lines-total"><th scope="row" colSpan={3}>Total due</th><td>{formatCents(order.totalCents)}</td></tr>
        </tfoot>
      </table>
    </div>
  );
}
