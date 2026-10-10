/**
 * Zaddys logo slot.
 *
 * TODO(zaddys): add the official logo file at /public/images/logo.png and set
 * LOGO_SRC. It is rendered as-is — never recolored. Until then a plain text
 * wordmark stands in (not an imitation of the logo artwork).
 */
const LOGO_SRC = null;

export default function BrandMark({ className = '' }) {
  if (LOGO_SRC) {
    return <img src={LOGO_SRC} alt="Zaddys Subs & Deli Shop" className={`brand-logo ${className}`} />;
  }
  return (
    <span className={`brand-wordmark ${className}`} title="Logo placeholder — official logo file not yet supplied">
      Zaddys
    </span>
  );
}
