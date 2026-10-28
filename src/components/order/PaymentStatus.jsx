const LABELS = {
  pending: ['Awaiting payment confirmation', 'We have not confirmed a payment for this order yet.'],
  manual_review: ['Payment under review', 'Our staff are checking a payment for this order.'],
  paid: ['Payment confirmed', 'Our staff confirmed your payment arrived.'],
  failed: ['Payment not completed', 'This payment could not be completed.'],
  cancelled: ['Cancelled', 'This order was cancelled.'],
};

export function paymentStatusLabel(status) {
  return (LABELS[status] || [status])[0];
}

export default function PaymentStatus({ status, orderStatus }) {
  const [label, detail] = LABELS[status] || [status, ''];
  return (
    <div className={`pay-status pay-status-${status}`} role="status">
      <span className="pay-status-dot" aria-hidden="true" />
      <div>
        <p className="pay-status-label">{label}</p>
        <p className="pay-status-detail">
          {detail}
          {orderStatus === 'completed' && ' Order completed.'}
        </p>
      </div>
    </div>
  );
}
