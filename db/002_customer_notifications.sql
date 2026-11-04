-- ===========================================================================
-- 002: remembered customers + automatic order messages (email via Amazon SES,
-- SMS via AWS End User Messaging SMS).
--
-- Run AFTER db/schema.sql, in the shared salesMastery project. Additive and
-- idempotent: safe to run more than once. Nothing is dropped.
--
-- * client_customers: one row per customer per client (keyed by phone), with
--   name, email and how they want order updates. SMS consent is recorded with
--   when and how it was given.
-- * client_notifications: every message the system sends (or skips/fails),
--   one row per order + channel + kind, so a retry never double-sends.
-- * clients: per-client sender settings (from-address, SMS number). Messages
--   go out only when notifications_enabled is true.
-- Same access model as schema.sql: members read their own client's rows,
-- only the server (service role) writes.
-- ===========================================================================

-- ---------------------------------------------------------------- clients
alter table public.clients
  add column if not exists notifications_enabled boolean not null default false,
  -- Sender on a verified Amazon SES domain, e.g. '"Zaddys" <zaddys@send.seamlessly.us>'.
  add column if not exists email_from_address text,
  -- Where customer replies go, e.g. 'zaddysintampa@gmail.com'.
  add column if not exists email_reply_to text,
  -- AWS End User Messaging SMS origination identity (phone number in E.164,
  -- or its phone-number ID/ARN). Must be registered (toll-free verification or
  -- 10DLC) before US carriers deliver.
  add column if not exists sms_origination_identity text;

-- ------------------------------------------------------- client_customers
create table if not exists public.client_customers (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  phone_e164 text not null check (phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  name text not null check (length(name) between 1 and 80),
  email text check (email is null or length(email) between 3 and 120),
  notify_sms boolean not null default false,
  notify_email boolean not null default false,
  -- Express consent for order texts: when and how (customer ticked the box
  -- online, or told staff yes). Required before any SMS is sent.
  sms_consent_at timestamptz,
  sms_consent_source text check (sms_consent_source in ('online_checkout', 'staff_verbal')),
  -- Set when the number replies STOP (carrier/AWS opt-out). Cleared only by a
  -- new, explicit opt-in.
  sms_opted_out_at timestamptz,
  order_count integer not null default 0,
  last_order_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, phone_e164),
  unique (id, client_id)
);

drop trigger if exists client_customers_touch on public.client_customers;
create trigger client_customers_touch before update on public.client_customers
  for each row execute function public.ordering_touch_updated_at();

alter table public.client_customers enable row level security;

drop policy if exists client_customers_member_read on public.client_customers;
create policy client_customers_member_read on public.client_customers
  for select to authenticated using (public.ordering_is_client_member(client_id));

revoke insert, update, delete on public.client_customers from anon, authenticated;

-- ------------------------------------------------------- client_orders
-- The customer an order belongs to, and the update channels chosen for it.
alter table public.client_orders
  add column if not exists customer_id uuid,
  add column if not exists notify_sms boolean not null default false,
  add column if not exists notify_email boolean not null default false;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'client_orders_customer_fk') then
    alter table public.client_orders
      add constraint client_orders_customer_fk
      foreign key (customer_id, client_id) references public.client_customers (id, client_id);
  end if;
end;
$$;

create index if not exists client_orders_customer_idx on public.client_orders (client_id, customer_id);

-- --------------------------------------------------- client_notifications
create table if not exists public.client_notifications (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  order_id uuid not null,
  channel text not null check (channel in ('email', 'sms')),
  kind text not null check (kind in ('order_placed', 'payment_confirmed', 'order_cancelled')),
  recipient text not null,
  status text not null check (status in ('sending', 'sent', 'failed', 'skipped')),
  -- Short machine-readable reason for failed/skipped, e.g. 'not_configured', 'opted_out'.
  reason text,
  error text,
  provider_message_id text,
  attempts integer not null default 1,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_id, channel, kind),
  foreign key (order_id, client_id) references public.client_orders (id, client_id) on delete cascade
);

create index if not exists client_notifications_order_idx on public.client_notifications (client_id, order_id);

drop trigger if exists client_notifications_touch on public.client_notifications;
create trigger client_notifications_touch before update on public.client_notifications
  for each row execute function public.ordering_touch_updated_at();

alter table public.client_notifications enable row level security;

drop policy if exists client_notifications_member_read on public.client_notifications;
create policy client_notifications_member_read on public.client_notifications
  for select to authenticated using (public.ordering_is_client_member(client_id));

revoke insert, update, delete on public.client_notifications from anon, authenticated;

-- ------------------------------------------------ ordering_remember_customer
-- Upserts the customer for an order (by client + phone), records their
-- update preferences and SMS consent, and links the order. Called by the
-- server right after ordering_create_order. Counts the order only once, so a
-- retried checkout doesn't inflate order_count.
create or replace function public.ordering_remember_customer(
  p_client_id uuid,
  p_order_id uuid,
  p_phone_e164 text,
  p_name text,
  p_email text,
  p_notify_sms boolean,
  p_notify_email boolean,
  p_consent_source text
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_customer_id uuid;
  v_order public.client_orders%rowtype;
  v_email text := nullif(lower(trim(p_email)), '');
begin
  select * into v_order from public.client_orders
   where id = p_order_id and client_id = p_client_id
   for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if p_notify_sms and p_consent_source not in ('online_checkout', 'staff_verbal') then
    raise exception 'invalid_consent_source';
  end if;

  insert into public.client_customers as c
    (client_id, phone_e164, name, email, notify_sms, notify_email,
     sms_consent_at, sms_consent_source, order_count, last_order_at)
  values
    (p_client_id, p_phone_e164, p_name, v_email, p_notify_sms, p_notify_email and v_email is not null,
     case when p_notify_sms then now() end, case when p_notify_sms then p_consent_source end,
     0, v_order.created_at)
  on conflict (client_id, phone_e164) do update set
    name = excluded.name,
    -- Keep the email on file if this order didn't include one.
    email = coalesce(excluded.email, c.email),
    notify_sms = p_notify_sms,
    notify_email = p_notify_email and coalesce(excluded.email, c.email) is not null,
    -- A fresh tick counts as fresh consent (and lifts an earlier STOP).
    sms_consent_at = case when p_notify_sms then now() else c.sms_consent_at end,
    sms_consent_source = case when p_notify_sms then p_consent_source else c.sms_consent_source end,
    sms_opted_out_at = case when p_notify_sms then null else c.sms_opted_out_at end,
    last_order_at = greatest(c.last_order_at, excluded.last_order_at)
  returning id into v_customer_id;

  if v_order.customer_id is distinct from v_customer_id then
    update public.client_customers set order_count = order_count + 1 where id = v_customer_id;
    update public.client_orders
       set customer_id = v_customer_id,
           notify_sms = p_notify_sms,
           notify_email = p_notify_email and coalesce(v_email, v_order.customer_email) is not null
     where id = p_order_id;
  end if;

  return v_customer_id;
end;
$$;

revoke all on function public.ordering_remember_customer(uuid, uuid, text, text, text, boolean, boolean, text) from public, anon, authenticated;
grant execute on function public.ordering_remember_customer(uuid, uuid, text, text, text, boolean, boolean, text) to service_role;

-- ---------------------------------------------------------------- zaddys
-- Sender settings. Email goes out from the shared platform sending domain
-- send.seamlessly.us (verified once in SES for all clients); replies go to the
-- restaurant. notifications_enabled stays false until the AWS side is ready
-- (SES domain verified + out of sandbox; SMS number registered).
update public.clients
   set email_from_address = coalesce(email_from_address, '"Zaddys Subs & Deli Shop" <zaddys@send.seamlessly.us>'),
       email_reply_to = coalesce(email_reply_to, 'zaddysintampa@gmail.com')
 where slug = 'zaddys';
