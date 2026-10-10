/**
 * Clearly marked stand-in for photography that hasn't been supplied yet.
 * Never styled to look like real Zaddys photography.
 */
export default function Placeholder({ label, className = '' }) {
  return (
    <div className={`placeholder ${className}`} role="img" aria-label={`Placeholder: ${label}`}>
      <span className="placeholder-tag">Placeholder</span>
      <span className="placeholder-label">{label}</span>
    </div>
  );
}
