import { restaurant } from '../../data/restaurant';

export const EMPTY_CUSTOMER = { name: '', phone: '', email: '', notifySms: false, notifyEmail: false };

/**
 * Name / phone / optional email, plus how the customer wants order updates
 * (text and/or email). `mode="staff"` words the choices for an employee
 * asking the customer. `errors` keys match the server's field errors.
 */
export default function CustomerFields({ values, onChange, errors = {}, idPrefix = 'customer', mode = 'customer', onPhoneBlur }) {
  const staff = mode === 'staff';
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
  const check = (key, label) => (
    <label className="check">
      <input type="checkbox" checked={Boolean(values[key])} onChange={(e) => onChange({ ...values, [key]: e.target.checked })} />
      <span>{label}</span>
    </label>
  );

  return (
    <div className="fields">
      {field('name', 'Name', { autoComplete: staff ? 'off' : 'name', required: true, maxLength: 80 })}
      {field('phone', 'Phone', { type: 'tel', autoComplete: staff ? 'off' : 'tel', inputMode: 'tel', required: true, maxLength: 30, onBlur: onPhoneBlur })}
      {field('email', values.notifyEmail ? 'Email' : 'Email (optional)', { type: 'email', autoComplete: staff ? 'off' : 'email', maxLength: 120 })}
      <fieldset className="notify-choice">
        <legend>{staff ? 'Send the customer order updates by' : 'Send me order updates by'}</legend>
        {check('notifySms', staff ? 'Text message (customer said yes to texts)' : 'Text message')}
        {check('notifyEmail', 'Email')}
        <p className="notify-fine-print">
          {staff
            ? 'Only tick Text message if the customer agreed to get order texts at this number. They can reply STOP to opt out.'
            : (
              <>
                By choosing text message, you agree to receive order and delivery texts from {restaurant.fullName} at this
                number (order confirmation, payment and status updates). Consent is optional and not a condition of
                purchase. Message frequency varies. Msg &amp; data rates may apply. Reply STOP to unsubscribe, HELP for
                help. See our <a href="/terms-of-service" target="_blank" rel="noopener">Terms of Service</a> and{' '}
                <a href="/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a>.
              </>
            )}
        </p>
      </fieldset>
    </div>
  );
}

/** Same checks the server runs, so most mistakes are caught before submitting. */
export function validateCustomer(values) {
  const errors = {};
  if (values.name.trim().length < 2) errors.name = 'Please enter your name.';
  const digits = values.phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 15) errors.phone = 'Please enter a valid phone number.';
  const email = values.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.email = 'Please enter a valid email or leave it blank.';
  } else if (values.notifyEmail && !email) {
    errors.email = 'Enter an email address to get email updates.';
  }
  return errors;
}

/** Request body shape for `customer`. */
export function customerPayload(values) {
  return {
    name: values.name.trim(),
    phone: values.phone.trim(),
    email: values.email.trim(),
    notifySms: Boolean(values.notifySms),
    notifyEmail: Boolean(values.notifyEmail),
  };
}
