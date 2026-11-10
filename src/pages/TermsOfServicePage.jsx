import { useEffect } from 'react';
import { restaurant } from '../data/restaurant';

// Keep the SMS section in step with the opt-in text in
// components/order/CustomerFields.jsx, the privacy policy and the toll-free
// SMS registration.
const EFFECTIVE = 'November 10, 2026';

/** /terms-of-service — public terms for ordering and the SMS (text message) program. */
export default function TermsOfServicePage() {
  useEffect(() => {
    document.title = `Terms of Service | ${restaurant.fullName}`;
  }, []);

  const { address } = restaurant;
  const name = restaurant.fullName;

  return (
    <section className="section legal-page" aria-labelledby="terms-title">
      <div className="container legal-inner">
        <p className="eyebrow">Legal</p>
        <h1 id="terms-title" className="section-title">Terms of Service</h1>
        <p className="legal-meta">Effective {EFFECTIVE}</p>

        <p>
          These terms apply when you use this website or order from {name} (“Zaddys”, “we”, “us”), {address.street},{' '}
          {address.city}, {address.state} {address.zip}, online, by phone or in person, and when you receive our order
          text messages or emails. By placing an order or opting in to texts, you agree to these terms and to our{' '}
          <a href="/privacy-policy">Privacy Policy</a>.
        </p>

        <h2>Orders and prices</h2>
        <ul>
          <li>Menu items, prices and availability can change, and some items are limited-time or seasonal.</li>
          <li>Florida sales tax is added to your order as shown at checkout.</li>
          <li>Your order is confirmed with an order number. If an item becomes unavailable, we will contact you.</li>
          <li>Online orders have size limits shown at checkout. For larger orders, please call us.</li>
        </ul>

        <h2>Payment</h2>
        <ul>
          <li>We accept payment by Cash App or Zelle as shown on your order. You pay in Cash App or your own bank’s app; we never ask for your login, PIN or account numbers.</li>
          <li>Please send the exact amount shown and include your order number in the payment note or memo.</li>
          <li>Your order is marked paid once our staff see your payment arrive in our account. A screenshot or message is not proof of payment.</li>
          <li>For questions about a payment, a cancellation or a refund, call us at <a href={restaurant.phoneHref}>{restaurant.phone}</a>.</li>
        </ul>

        <h2 id="sms">Text message (SMS) program</h2>
        <ul>
          <li><strong>Program:</strong> {name} order notifications.</li>
          <li><strong>What you get:</strong> order and delivery notifications for orders you place: order confirmation with payment instructions, payment received, and order status or cancellation. No marketing messages.</li>
          <li><strong>How you join:</strong> by choosing “Text message” under “Send me order updates by” at checkout, or by telling our staff yes when ordering by phone. Joining is optional and not a condition of purchase.</li>
          <li><strong>Frequency:</strong> message frequency varies with your orders, usually 1 to 3 messages per order.</li>
          <li><strong>Cost:</strong> message and data rates may apply, according to your mobile plan.</li>
          <li><strong>Opt out:</strong> reply <strong>STOP</strong> to any message to unsubscribe. You will receive one message confirming you are unsubscribed and no further texts unless you opt in again.</li>
          <li><strong>Help:</strong> reply <strong>HELP</strong> to any message, or call <a href={restaurant.phoneHref}>{restaurant.phone}</a>{restaurant.email && <> or email <a href={`mailto:${restaurant.email}`}>{restaurant.email}</a></>}.</li>
          <li>Carriers are not liable for delayed or undelivered messages.</li>
          <li>Your phone number and text-message consent are not shared with third parties for their marketing. See our <a href="/privacy-policy">Privacy Policy</a>.</li>
        </ul>

        <h2>Email updates</h2>
        <p>If you choose email updates, we send the same order notifications by email. They are about your order only.</p>

        <h2>Using this website</h2>
        <p>
          Please use this website only to view our menu and place genuine orders. Don’t misuse it, interfere with how it
          works, or place orders you don’t intend to pay for. We may refuse or cancel orders that look fraudulent or abusive.
        </p>

        <h2>Changes</h2>
        <p>We may update these terms. The current version is always on this page with its effective date.</p>

        <h2>Contact us</h2>
        <p>
          {name}<br />
          {address.street}, {address.city}, {address.state} {address.zip}<br />
          Phone: <a href={restaurant.phoneHref}>{restaurant.phone}</a>
          {restaurant.email && <><br />Email: <a href={`mailto:${restaurant.email}`}>{restaurant.email}</a></>}
        </p>
      </div>
    </section>
  );
}
