/** Choose Cash App or Zelle — only the methods the restaurant has set up are offered. */
export default function PaymentMethodPicker({ methods, value, onChange, error, name = 'payment-method' }) {
  if (!methods.length) {
    return <p className="field-error" role="alert">Online payment isn't set up yet. Please call the shop to order.</p>;
  }
  return (
    <fieldset className="pay-picker" aria-describedby={error ? `${name}-error` : undefined}>
      <legend>How will you pay?</legend>
      {methods.map((m) => (
        <label key={m.id} className={`pay-picker-option${value === m.id ? ' is-selected' : ''}`}>
          <input type="radio" name={name} value={m.id} checked={value === m.id} onChange={() => onChange(m.id)} />
          {m.label}
        </label>
      ))}
      {error && <p className="field-error" id={`${name}-error`}>{error}</p>}
    </fieldset>
  );
}
