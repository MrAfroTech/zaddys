import { useState } from 'react';
import { payments } from '../../data/restaurant';

/**
 * Payment instructions from the server. The customer can pay by any method
 * the restaurant offers (`instructions.options`, the one picked at checkout
 * first): the Cash App button opens the restaurant's $Cashtag with the amount
 * filled in (the note can't be pre-filled), next to the restaurant's official
 * Cash App QR code; Zelle has no payment link, so its recipient can be copied
 * for the bank app. Nothing here
 * confirms payment. `forStaff` adds copy / open-in-Messages tools.
 */
export default function PaymentInstructions({ instructions, forStaff = false, customerPhone = '' }) {
  const [copied, setCopied] = useState('');
  const [handleCopied, setHandleCopied] = useState(false);
  const options = instructions?.configured ? instructions.options || [] : [];
  const [selectedId, setSelectedId] = useState(options[0]?.id || null);
  const selected = options.find((o) => o.id === selectedId) || options[0] || null;
  if (!instructions) return null;

  async function copyHandle() {
    try {
      await navigator.clipboard.writeText(selected.handle);
      setHandleCopied(true);
    } catch {
      setHandleCopied(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(instructions.messageText);
      setCopied('Copied. Paste it into a text message to the customer.');
    } catch {
      setCopied('Could not copy automatically — select the text above and copy it.');
    }
  }

  const smsDigits = customerPhone.replace(/[^\d+]/g, '');
  const smsHref = smsDigits ? `sms:${smsDigits}?&body=${encodeURIComponent(instructions.messageText)}` : null;
  const steps = selected ? selected.steps : instructions.steps;

  return (
    <section className="pay-instructions" aria-labelledby="pay-title">
      <h3 id="pay-title">How to pay</h3>
      <p className="pay-amount">
        Amount due <strong>{instructions.amountDisplay}</strong> · Order <strong>{instructions.orderNumber}</strong>
      </p>

      {options.length > 1 && (
        <div className="pay-switch" role="group" aria-label="Pay with">
          {options.map((o) => (
            <button
              key={o.id}
              type="button"
              className={`pay-switch-btn pay-switch-${o.id}${o.id === selected.id ? ' is-active' : ''}`}
              aria-pressed={o.id === selected.id}
              onClick={() => {
                setSelectedId(o.id);
                setHandleCopied(false);
              }}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {selected?.payUrl && (
        <div className="pay-cashapp">
          <a href={selected.payUrl} className="btn btn-primary btn-lg btn-cashapp" target="_blank" rel="noopener noreferrer">
            Pay {instructions.amountDisplay} with Cash App
          </a>
          {payments.cashAppQr && (
            <figure className="pay-qr">
              <a href={selected.payUrl} target="_blank" rel="noopener noreferrer">
                <img src={payments.cashAppQr} width="160" height="160" alt={`Cash App QR code for ${selected.handle}`} />
              </a>
              <figcaption>
                {forStaff
                  ? `Customer can scan this to pay ${selected.handle}. They enter ${instructions.amountDisplay} and ${instructions.orderNumber} in the note.`
                  : `Or scan with your phone camera. Enter ${instructions.amountDisplay} and ${instructions.orderNumber} in the note.`}
              </figcaption>
            </figure>
          )}
        </div>
      )}
      {selected && !selected.payUrl && (
        <div className="pay-zelle">
          <p className="pay-zelle-to">
            Zelle to <strong>{selected.handle}</strong>
          </p>
          <div className="btn-row">
            <button type="button" className="btn btn-primary btn-lg btn-zelle" onClick={copyHandle}>
              {handleCopied ? 'Copied — now open your bank app' : 'Copy Zelle email'}
            </button>
          </div>
          {payments.zelleQr && (
            <figure className="pay-qr">
              <img src={payments.zelleQr} width="160" height="160" alt={`Zelle QR code for ${selected.handle}`} />
              <figcaption>Scan in your bank app’s Zelle screen.</figcaption>
            </figure>
          )}
        </div>
      )}

      <ol className="pay-steps">
        {steps.map((s) => <li key={s}>{s}</li>)}
      </ol>

      {forStaff && (
        <div className="pay-message">
          <label htmlFor="pay-message-text">Message for the customer</label>
          <textarea id="pay-message-text" readOnly rows={7} value={instructions.messageText} />
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={copy}>Copy message</button>
            {smsHref && <a className="btn btn-outline" href={smsHref}>Open in Messages</a>}
          </div>
          <p className="pay-message-note" aria-live="polite">
            {copied || 'To send it from your own phone instead, copy the message or open it in Messages.'}
          </p>
        </div>
      )}
    </section>
  );
}
