/**
 * Automatic order messages to customers.
 *
 * - Email goes out through Amazon SES (SESv2 SendEmail) from the client's
 *   verified sender (clients.email_from_address).
 * - SMS goes out through AWS End User Messaging SMS (SendTextMessage) from the
 *   client's registered number (clients.sms_origination_identity). SES itself
 *   cannot send SMS. Texts go only to customers who opted in, and carry STOP
 *   instructions; AWS handles STOP replies and we record the opt-out when AWS
 *   rejects a send for it.
 *
 * Every attempt is recorded in client_notifications, one row per
 * order + channel + kind, so retries (a double-submitted checkout, a function
 * retry) never send twice. A failed message never fails the order: staff see
 * the status and can resend, or fall back to copying the message.
 */
import { SESv2Client, SendEmailCommand } from '@aws-sdk/client-sesv2';
import { PinpointSMSVoiceV2Client, SendTextMessageCommand } from '@aws-sdk/client-pinpoint-sms-voice-v2';
import { serviceClient } from './supabase.js';
import { formatCents } from './money.js';
import { paymentInstructions } from './payment-methods.js';
import { orderStatusPath } from './order-links.js';
import { markSmsOptedOut, phoneE164 } from './customers.js';

const SEND_TIMEOUT_MS = 8000;
// A row stuck in 'sending' longer than this (crashed function) may be retried.
const STALE_SENDING_MS = 60_000;

let ses = null;
let sms = null;

function awsConfig() {
  const accessKeyId = process.env.MESSAGING_AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.MESSAGING_AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) return null;
  return { region: process.env.MESSAGING_AWS_REGION || 'us-east-1', credentials: { accessKeyId, secretAccessKey } };
}

function sesClient() {
  return (ses ||= new SESv2Client(awsConfig()));
}

function smsClient() {
  return (sms ||= new PinpointSMSVoiceV2Client(awsConfig()));
}

/** Why a channel can't send for this client right now, or null if it can. */
function channelBlocker(client, channel) {
  if (!client.notifications_enabled) return 'not_enabled';
  if (!awsConfig()) return 'not_configured';
  if (channel === 'email' && !client.email_from_address) return 'not_configured';
  if (channel === 'sms' && !client.sms_origination_identity) return 'not_configured';
  return null;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** Subject/text/html for email and a short body for SMS. */
export function compose({ client, order, items, kind, statusUrl }) {
  const name = client.name;
  const num = order.order_number;
  const total = formatCents(order.total_cents);
  const first = order.customer_name.split(/\s+/)[0];
  const pay = kind === 'order_placed' ? paymentInstructions(order, client) : null;

  let subject;
  let lines;
  let smsBody;
  if (kind === 'order_placed') {
    subject = `${name} order ${num} — ${total} due`;
    const how = pay?.configured
      ? pay.method === 'cash_app'
        ? `Pay with Cash App to ${pay.handle} (${pay.url})`
        : `Pay with Zelle to ${pay.handle}`
      : 'We will contact you with how to pay';
    lines = [
      `Hi ${first}, thanks for your order!`,
      '',
      `Order ${num}`,
      ...items.map((i) => `${i.quantity} × ${i.name_snapshot} — ${formatCents(i.line_total_cents)}`),
      `Subtotal ${formatCents(order.subtotal_cents)}`,
      ...(order.tax_cents ? [`${order.sales_tax_label || 'Sales tax'} ${formatCents(order.tax_cents)}`] : []),
      `Total ${total}`,
      '',
      'How to pay:',
      ...(pay?.steps || []).map((s, i) => `${i + 1}. ${s}`),
    ];
    smsBody = `${name}: order ${num} received. Total ${total}. ${how} and put ${num} in the note.`;
  } else if (kind === 'payment_confirmed') {
    subject = `${name} order ${num} — payment received`;
    lines = [`Hi ${first}, we received your payment of ${total} for order ${num}. Thank you!`];
    smsBody = `${name}: payment of ${total} received for order ${num}. Thank you!`;
  } else {
    subject = `${name} order ${num} — cancelled`;
    lines = [`Hi ${first}, your order ${num} has been cancelled. If you have questions, reply to this email or call the shop.`];
    smsBody = `${name}: order ${num} was cancelled. Questions? Please call the shop.`;
  }

  if (statusUrl) {
    lines.push('', `Order status: ${statusUrl}`);
    smsBody += ` Status: ${statusUrl}`;
  }
  smsBody += ' Reply STOP to opt out.';

  const text = lines.join('\n');
  const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1d1d1d">${
    lines.map((l) => (l ? `<p style="margin:0 0 6px">${escapeHtml(l).replace(/(https?:\/\/\S+)/g, '<a href="$1">$1</a>')}</p>` : '<br>')).join('')
  }<p style="margin-top:18px;color:#666;font-size:13px">${escapeHtml(name)}</p></body></html>`;

  return { subject, text, html, smsBody };
}

async function sendEmail(client, to, msg) {
  const out = await sesClient().send(
    new SendEmailCommand({
      FromEmailAddress: client.email_from_address,
      ReplyToAddresses: client.email_reply_to ? [client.email_reply_to] : undefined,
      Destination: { ToAddresses: [to] },
      Content: {
        Simple: {
          Subject: { Data: msg.subject, Charset: 'UTF-8' },
          Body: { Text: { Data: msg.text, Charset: 'UTF-8' }, Html: { Data: msg.html, Charset: 'UTF-8' } },
        },
      },
    }),
    { abortSignal: AbortSignal.timeout(SEND_TIMEOUT_MS) },
  );
  return out.MessageId;
}

async function sendSms(client, to, msg) {
  const out = await smsClient().send(
    new SendTextMessageCommand({
      DestinationPhoneNumber: to,
      OriginationIdentity: client.sms_origination_identity,
      MessageBody: msg.smsBody,
      MessageType: 'TRANSACTIONAL',
    }),
    { abortSignal: AbortSignal.timeout(SEND_TIMEOUT_MS) },
  );
  return out.MessageId;
}

/**
 * Claims the (order, channel, kind) slot. Returns the row id to send with, or
 * null when it was already sent / is being sent and this isn't a forced resend.
 */
async function claim(client, order, channel, kind, recipient, force) {
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from('client_notifications')
    .insert({ client_id: client.id, order_id: order.id, channel, kind, recipient, status: 'sending' })
    .select('id')
    .single();
  if (!error) return data.id;
  if (error.code !== '23505') throw error;

  const { data: row, error: readError } = await supabase
    .from('client_notifications')
    .select('id, status, attempts, updated_at')
    .eq('order_id', order.id)
    .eq('channel', channel)
    .eq('kind', kind)
    .single();
  if (readError) throw readError;
  const stale = Date.now() - new Date(row.updated_at).getTime() > STALE_SENDING_MS;
  if (row.status === 'sending' && !stale) return null;
  if (row.status === 'sent' && !force) return null;

  const { error: updError } = await supabase
    .from('client_notifications')
    .update({ status: 'sending', recipient, attempts: row.attempts + 1, reason: null, error: null })
    .eq('id', row.id);
  if (updError) throw updError;
  return row.id;
}

async function finish(id, fields) {
  const { error } = await serviceClient().from('client_notifications').update(fields).eq('id', id);
  if (error) console.error('notification_update_failed', { id, message: error.message });
}

/** Records a channel that was requested but can't be sent, without overwriting a sent row. */
async function recordSkipped(client, order, channel, kind, recipient, reason) {
  const { error } = await serviceClient()
    .from('client_notifications')
    .upsert(
      { client_id: client.id, order_id: order.id, channel, kind, recipient, status: 'skipped', reason },
      { onConflict: 'order_id,channel,kind', ignoreDuplicates: true },
    );
  if (error) console.error('notification_skip_failed', { orderId: order.id, message: error.message });
}

async function customerOptedOut(client, order) {
  if (!order.customer_id) return false;
  const { data } = await serviceClient()
    .from('client_customers')
    .select('sms_opted_out_at')
    .eq('client_id', client.id)
    .eq('id', order.customer_id)
    .maybeSingle();
  return Boolean(data?.sms_opted_out_at);
}

/**
 * Sends `kind` for an order on every channel the customer chose. Safe to call
 * repeatedly. `force` resends even if already sent (staff "Resend"). Never
 * throws for delivery problems — those are recorded on the notification row.
 */
export async function notifyOrder({ client, order, items, kind, origin = '', force = false, channels = null }) {
  const wanted = [];
  if (order.notify_email && order.customer_email) wanted.push(['email', order.customer_email]);
  if (order.notify_sms) wanted.push(['sms', phoneE164(order.customer_phone)]);
  const targets = wanted.filter(([ch]) => !channels || channels.includes(ch));
  if (!targets.length) return;

  const statusUrl = origin ? `${origin}${orderStatusPath(order.id)}` : '';
  const msg = compose({ client, order, items, kind, statusUrl });

  await Promise.all(targets.map(async ([channel, recipient]) => {
    try {
      if (!recipient) return recordSkipped(client, order, channel, kind, order.customer_phone, 'invalid_number');
      const blocker = channelBlocker(client, channel);
      if (blocker) return recordSkipped(client, order, channel, kind, recipient, blocker);
      if (channel === 'sms' && await customerOptedOut(client, order)) {
        return recordSkipped(client, order, channel, kind, recipient, 'opted_out');
      }

      const id = await claim(client, order, channel, kind, recipient, force);
      if (!id) return;
      try {
        const messageId = channel === 'email' ? await sendEmail(client, recipient, msg) : await sendSms(client, recipient, msg);
        await finish(id, { status: 'sent', provider_message_id: messageId || null, sent_at: new Date().toISOString() });
      } catch (err) {
        const optedOut = err?.Reason === 'DESTINATION_PHONE_NUMBER_OPTED_OUT';
        if (optedOut) await markSmsOptedOut(client.id, order.customer_id);
        console.error('notification_send_failed', { orderId: order.id, channel, kind, name: err?.name, message: err?.message });
        await finish(id, {
          status: 'failed',
          reason: optedOut ? 'opted_out' : err?.name === 'TimeoutError' || err?.name === 'AbortError' ? 'timeout' : 'provider_error',
          error: String(err?.message || err).slice(0, 300),
        });
      }
    } catch (err) {
      console.error('notification_failed', { orderId: order.id, channel, kind, message: err?.message });
    }
  }));
}

/** Notification rows for a set of orders, grouped by order id, for staff views. */
export async function notificationsByOrder(clientId, orderIds) {
  if (!orderIds.length) return {};
  const { data, error } = await serviceClient()
    .from('client_notifications')
    .select('order_id, channel, kind, recipient, status, reason, error, attempts, sent_at, updated_at')
    .eq('client_id', clientId)
    .in('order_id', orderIds)
    .order('created_at');
  if (error) {
    // e.g. before db/002 is applied — ordering keeps working without it.
    console.error('notifications_read_failed', { message: error.message });
    return {};
  }
  return data.reduce((acc, r) => ((acc[r.order_id] ||= []).push(r), acc), {});
}

export function notificationView(rows) {
  return (rows || []).map((r) => ({
    channel: r.channel,
    kind: r.kind,
    recipient: r.recipient,
    status: r.status,
    reason: r.reason,
    error: r.error,
    attempts: r.attempts,
    sentAt: r.sent_at,
    updatedAt: r.updated_at,
  }));
}
