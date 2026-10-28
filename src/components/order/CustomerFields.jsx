/** Name / phone / optional email. `errors` keys match the server's field errors. */
export default function CustomerFields({ values, onChange, errors = {}, idPrefix = 'customer' }) {
  const field = (key, label, props) => (
    <div className="field">
      <label htmlFor={`${idPrefix}-${key}`}>{label}</label>
      <input
        id={`${idPrefix}-${key}`}
        value={values[key]}
        onChange={(e) => onChange({ ...values, [key]: e.target.value })}
        aria-invalid={errors[key] ? 'true' : undefined}
        aria-describedby={errors[key] ? `${idPrefix}-${key}-error` : undefined}
        {...props}
      />
      {errors[key] && <p className="field-error" id={`${idPrefix}-${key}-error`}>{errors[key]}</p>}
    </div>
  );

  return (
    <div className="fields">
      {field('name', 'Name', { autoComplete: 'name', required: true, maxLength: 80 })}
      {field('phone', 'Phone', { type: 'tel', autoComplete: 'tel', inputMode: 'tel', required: true, maxLength: 30 })}
      {field('email', 'Email (optional)', { type: 'email', autoComplete: 'email', maxLength: 120 })}
    </div>
  );
}

/** Same checks the server runs, so most mistakes are caught before submitting. */
export function validateCustomer(values) {
  const errors = {};
  if (values.name.trim().length < 2) errors.name = 'Please enter your name.';
  const digits = values.phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) errors.phone = 'Please enter a valid phone number.';
  if (values.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
    errors.email = 'Please enter a valid email or leave it blank.';
  }
  return errors;
}
