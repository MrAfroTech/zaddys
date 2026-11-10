import { useEffect } from 'react';
import { restaurant } from '../data/restaurant';

// Keep in step with the opt-in text in components/order/CustomerFields.jsx and
// the toll-free SMS registration.
const EFFECTIVE = 'November 10, 2026';

/** /privacy-policy — public privacy policy, including the SMS (text message) terms. */
export default function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = `Privacy Policy | ${restaurant.fullName}`;
  }, []);

  const { address } = restaurant;
  const name = restaurant.fullName;

  return (
    <section className="section legal-page" aria-labelledby="privacy-title">
      <div className="container legal-inner">
        <p className="eyebrow">Legal</p>
        <h1 id="privacy-title" className="section-title">Privacy Policy</h1>
        <p className="legal-meta">Effective {EFFECTIVE}</p>

        <p>
          This policy explains how {name} (“Zaddys”, “we”, “us”), {address.street}, {address.city}, {address.state}{' '}
          {address.zip}, collects and uses information when you visit this website, order online or by phone, or get
          order updates by text message or email.
        </p>

        <h2>Information we collect</h2>
        <ul>
          <li><strong>Order details:</strong> the items you order, totals, your order number, and the payment method you choose (Cash App or Zelle).</li>
          <li><strong>Contact details:</strong> your name, mobile phone number and, if you give it, your email address.</li>
          <li><strong>Update preferences:</strong> whether you chose order updates by text message and/or email, and when and how you agreed to texts.</li>
          <li><strong>Payment records:</strong> the amount and reference our staff see when your payment arrives in our Cash App or bank (Zelle) account. We never ask for or store your Cash App, bank or card login, PIN or account numbers. Payments are made in Cash App or your own bank’s app.</li>
        </ul>

        <h2>How we use it</h2>
        <ul>
          <li>To take, prepare and hand over your order, and to confirm your payment.</li>
          <li>To send the order and delivery notifications you choose: your order confirmation with payment instructions, payment received, and order status or cancellation.</li>
          <li>To reach you about your order if there is a problem.</li>
          <li>To remember your details for your next order so you don’t have to re-enter them.</li>
        </ul>

        <h2 id="sms">Text messages (SMS)</h2>
        <ul>
          <li><strong>Optional:</strong> texts are only sent if you choose “Text message” at checkout, or tell our staff yes when ordering by phone. Consent to receive texts is not a condition of purchase.</li>
          <li><strong>What we send:</strong> order and delivery notifications only: order confirmation with payment instructions, payment received, and order status updates. No marketing messages.</li>
          <li><strong>Frequency:</strong> message frequency varies with your orders, usually 1 to 3 messages per order.</li>
          <li><strong>Cost:</strong> message and data rates may apply.</li>
          <li><strong>Stop or get help:</strong> reply <strong>STOP</strong> to any text to unsubscribe; you will get one message confirming you’re unsubscribed. Reply <strong>HELP</strong> for help, or call us at <a href={restaurant.phoneHref}>{restaurant.phone}</a>.</li>
          <li>Carriers are not liable for delayed or undelivered messages.</li>
        </ul>

        <h2>Sharing</h2>
        <p>
          <strong>
            We do not sell your information. Your mobile phone number and your text-message (SMS) consent are not shared
            with third parties or affiliates for their marketing or promotional purposes.
          </strong>
        </p>
        <p>
          We share information only with service providers that run this ordering system for us (website hosting,
          our order database, and the services that deliver our text messages and emails), and only so they can
          provide that service. We may also disclose information if the law requires it.
        </p>

        <h2>Email</h2>
        <p>
          If you choose email updates, we send the same order notifications by email. These are about your order only;
          we don’t add you to a mailing list.
        </p>

        <h2>On your device</h2>
        <p>
          If you tick “Remember my details on this device” at checkout, your name, phone, email and update choices are
          saved in your browser on that device only. Untick it at your next checkout, or clear your browser’s site
          data, to remove them.
        </p>

        <h2>How long we keep it</h2>
        <p>
          We keep order and payment records as needed for our business and tax records. You can ask us to stop texts at
          any time (reply STOP) and to update or delete your contact details where we are not required to keep them.
        </p>

        <h2>Children</h2>
        <p>This site is not directed to children under 13, and we do not knowingly collect their information.</p>

        <p>See also our <a href="/terms-of-service">Terms of Service</a>, including the text message program terms.</p>

        <h2>Changes</h2>
        <p>If we change this policy, we will post the new version here with a new effective date.</p>

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
