import { useState } from 'react';

/**
 * Payment instructions from the server (Cash App or Zelle). The Cash App link
 * opens the restaurant's $Cashtag profile only — it does not pre-fill the
 * amount or confirm payment. Zelle has no payment link, so the recipient can
 * be copied. `forStaff` adds copy / open-in-Messages tools; nothing is sent
 * automatically.
 */
export default function PaymentInstructions({ instructions, forStaff = false, customerPhone = '' }) {
  const [copied, setCopied] = useState('');
  const [handleCopied, setHandleCopied] = useState(false);
  if (!instructions) return null;

  async function copyHandle() {
    try {
      await navigator.clipboard.writeText(instructions.handle);
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

  return (
    <section className="pay-instructions" aria-labelledby="pay-title">
      <h3 id="pay-title">How to pay{instructions.configured ? ` with ${instructions.methodLabel}` : ''}</h3>
      <p className="pay-amount">
        Amount due <strong>{instructions.amountDisplay}</strong> · Order <strong>{instructions.orderNumber}</strong>
      </p>
      <ol className="pay-steps">
        {instructions.steps.map((s) => <li key={s}>{s}</li>)}
      </ol>
      {instructions.configured && !forStaff && instructions.url && (
        <a href={instructions.url} className="btn btn-primary" target="_blank" rel="noopener noreferrer">
          Open {instructions.methodLabel} ({instructions.handle})
        </a>
      )}
      {instructions.configured && !forStaff && !instructions.url && (
        <div className="btn-row">
          <button type="button" className="btn btn-primary" onClick={copyHandle}>
            Copy {instructions.methodLabel} recipient ({instructions.handle})
          </button>
          <span aria-live="polite" className="pay-message-note">{handleCopied ? 'Copied.' : ''}</span>
        </div>
      )}
      {forStaff && (
        <div className="pay-message">
          <label htmlFor="pay-message-text">Message for the customer</label>
          <textarea id="pay-message-text" readOnly rows={7} value={instructions.messageText} />
          <div className="btn-row">
            <button type="button" className="btn btn-primary" onClick={copy}>Copy message</button>
            {smsHref && <a className="btn btn-outline" href={smsHref}>Open in Messages</a>}
          </div>
          <p className="pay-message-note" aria-live="polite">
            {copied || 'Nothing is sent automatically. Copy the message or open it in your Messages app and send it yourself.'}
          </p>
        </div>
      )}
    </section>
  );
}
