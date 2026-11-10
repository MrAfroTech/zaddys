-- ===========================================================================
-- 003: Zelle request queue.
--
-- Zelle can only be started inside a bank app, so a Zelle "request" is sent
-- by staff from the restaurant's own bank app. This tracks the hand-off:
--   requested -> a customer chose Zelle (or tapped "Send me a Zelle request")
--                and the order shows in the staff dashboard's queue;
--   sent      -> staff sent the request from the bank app.
-- Run after db/002. Additive and idempotent.
-- ===========================================================================

alter table public.client_orders
  add column if not exists zelle_request_status text
    check (zelle_request_status in ('requested', 'sent')),
  add column if not exists zelle_requested_at timestamptz,
  add column if not exists zelle_request_sent_at timestamptz,
  add column if not exists zelle_request_sent_by uuid references auth.users (id),
  add column if not exists zelle_request_sent_by_name text;

create index if not exists client_orders_zelle_queue_idx
  on public.client_orders (client_id, zelle_requested_at)
  where zelle_request_status = 'requested';

-- Allow these hand-offs in the order history.
alter table public.client_order_events drop constraint if exists client_order_events_field_check;
alter table public.client_order_events add constraint client_order_events_field_check
  check (field in ('payment_status', 'order_status', 'payment_flag', 'created', 'zelle_request'));

-- p_action 'request': customer/system asks for a Zelle request (no-op if one
--   is already requested or sent).
-- p_action 'sent': staff sent it from the bank app (staff required).
-- Only for open orders still waiting on payment. Returns the new status.
create or replace function public.ordering_zelle_request(
  p_client_id uuid,
  p_order_id uuid,
  p_action text,
  p_actor_type text,
  p_staff uuid default null,
  p_staff_name text default null
) returns text
language plpgsql security definer set search_path = public as $$
declare
  v_order public.client_orders%rowtype;
begin
  if p_action not in ('request', 'sent') or p_actor_type not in ('customer', 'staff', 'system') then
    raise exception 'invalid_action';
  end if;
  if p_action = 'sent' and (p_staff is null or not exists (
    select 1 from public.client_users cu
     where cu.client_id = p_client_id and cu.user_id = p_staff and cu.is_active)) then
    raise exception 'not_client_staff';
  end if;

  select * into v_order from public.client_orders
   where id = p_order_id and client_id = p_client_id
   for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.order_status <> 'open' or v_order.payment_status not in ('pending', 'manual_review') then
    raise exception 'not_awaiting_payment';
  end if;

  if p_action = 'request' then
    if v_order.zelle_request_status is not null then
      return v_order.zelle_request_status;
    end if;
    update public.client_orders
       set zelle_request_status = 'requested', zelle_requested_at = now()
     where id = p_order_id;
    insert into public.client_order_events (order_id, client_id, field, from_value, to_value, actor_type, actor_id, actor_name)
    values (p_order_id, p_client_id, 'zelle_request', null, 'requested', p_actor_type, p_staff, p_staff_name);
    return 'requested';
  end if;

  if v_order.zelle_request_status = 'sent' then
    return 'sent';
  end if;
  update public.client_orders
     set zelle_request_status = 'sent',
         zelle_requested_at = coalesce(zelle_requested_at, now()),
         zelle_request_sent_at = now(),
         zelle_request_sent_by = p_staff,
         zelle_request_sent_by_name = p_staff_name
   where id = p_order_id;
  insert into public.client_order_events (order_id, client_id, field, from_value, to_value, actor_type, actor_id, actor_name)
  values (p_order_id, p_client_id, 'zelle_request', v_order.zelle_request_status, 'sent', 'staff', p_staff, p_staff_name);
  return 'sent';
end;
$$;

revoke all on function public.ordering_zelle_request(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
grant execute on function public.ordering_zelle_request(uuid, uuid, text, text, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Zelle pay link: the link inside the restaurant's own Zelle QR code (from
-- its bank app). Tapping it opens Zelle's "find your bank" page, which hands
-- off to the customer's bank with the restaurant filled in as the recipient
-- (the amount can't be pre-filled). zelle_recipient_name is the name the
-- customer's bank shows for that Zelle account, so they know it's right.
-- ---------------------------------------------------------------------------
alter table public.clients
  add column if not exists zelle_pay_url text
    check (zelle_pay_url is null or zelle_pay_url ~ '^https://enroll\.zellepay\.com/qr-codes\?data=[A-Za-z0-9+/=_-]+$'),
  add column if not exists zelle_recipient_name text check (zelle_recipient_name is null or length(zelle_recipient_name) <= 120);

-- Zaddys: from the Zelle QR code in the owner's bank app.
update public.clients
   set zelle_pay_url = 'https://enroll.zellepay.com/qr-codes?data=eyJuYW1lIjoiUSZWIElOVkVTVE1FTlRTIElOQyIsImFjdGlvbiI6InBheW1lbnQiLCJ0b2tlbiI6IjgxMzQ0NjU0NDkifQ==',
       zelle_recipient_name = 'Q&V INVESTMENTS INC'
 where slug = 'zaddys';
