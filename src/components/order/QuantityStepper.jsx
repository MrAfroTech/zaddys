/** − / + quantity control with accessible labels. */
export default function QuantityStepper({ value, onChange, itemName, max, disabled = false }) {
  return (
    <div className="qty" role="group" aria-label={`Quantity of ${itemName}`}>
      <button
        type="button"
        className="qty-btn"
        onClick={() => onChange(value - 1)}
        disabled={disabled}
        aria-label={value <= 1 ? `Remove ${itemName}` : `Decrease ${itemName}`}
      >
        −
      </button>
      <output className="qty-value" aria-live="polite">{value}</output>
      <button
        type="button"
        className="qty-btn"
        onClick={() => onChange(value + 1)}
        disabled={disabled || value >= max}
        aria-label={`Increase ${itemName}`}
      >
        +
      </button>
    </div>
  );
}
