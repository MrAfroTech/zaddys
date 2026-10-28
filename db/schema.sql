-- Multi-client restaurant ordering — shared tables in the EXISTING Supabase
-- project (salesMastery, smqwemfobrqxnpcooigd), alongside Concier.
--
-- One set of tables serves every establishment; rows are separated by
-- client_id. Adding a restaurant = one row in clients (see
-- ordering_onboard_client below). Never create a Supabase project, database,
-- or per-client tables for a new client.
--
-- Names avoid Concier's existing tables: Concier already owns public.orders
-- (event reservations) and public.users (guest profiles), so restaurant food
-- orders live in public.client_orders. Staff log in with the project's
-- existing Supabase Auth (auth.users), the same accounts Concier uses.
--
-- Additive and idempotent: creates new objects only, never drops or rewrites
-- existing tables or data. Safe to re-run.
--
-- Access model
-- * Public (anon): read active clients, their active menus and menu items.
-- * Client staff (authenticated + active client_users row): read their own
--   client's data; owners/managers can edit their own menus, items and a
--   few client settings. Nothing from other clients is visible.
-- * Orders, payments and status changes are written ONLY by the server
--   (service role) through the ordering_* functions, which re-check the
--   client, the items' ownership and the staff member's membership.

create extension if not exists pgcrypto;

create or replace function public.ordering_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ===========================================================================
-- clients: one row per establishment
-- ===========================================================================
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,48}$'),
  name text not null check (length(name) between 1 and 160),
  status text not null default 'onboarding'
    check (status in ('onboarding', 'active', 'paused', 'archived')),
  order_number_prefix text not null check (order_number_prefix ~ '^[A-Z]{1,4}$'),
  timezone text not null default 'America/New_York',
  -- Cash App Business $Cashtag shown in payment instructions (public info). Null = not offered.
  cashapp_cashtag text check (cashapp_cashtag is null or cashapp_cashtag ~ '^\$[A-Za-z][A-Za-z0-9_-]{0,19}$'),
  -- Zelle recipient (the email or US mobile number the business's Zelle is enrolled with). Null = not offered.
  zelle_recipient text check (zelle_recipient is null or length(zelle_recipient) between 5 and 120),
  online_ordering_enabled boolean not null default false,
  -- Sales tax on the order subtotal, in basis points (750 = 7.50%), and the
  -- label customers see. Rates come from the Florida DOR (DR-15DSS) for the
  -- client's county; update when the state or county rate changes.
  sales_tax_rate_bp integer not null default 0 check (sales_tax_rate_bp between 0 and 2000),
  sales_tax_label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists clients_touch on public.clients;
create trigger clients_touch before update on public.clients
  for each row execute function public.ordering_touch_updated_at();

alter table public.clients enable row level security;

-- ===========================================================================
-- client_users: which auth users can work for which client, and as what
-- ===========================================================================
create table if not exists public.client_users (
  client_id uuid not null references public.clients (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'manager', 'order_taker')),
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (client_id, user_id)
);

create index if not exists client_users_user_idx on public.client_users (user_id);

alter table public.client_users enable row level security;

-- Membership check used by RLS policies. SECURITY DEFINER so policies can
-- consult client_users without granting direct access to it.
create or replace function public.ordering_is_client_member(p_client_id uuid, p_roles text[] default null)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.client_users cu
     where cu.client_id = p_client_id
       and cu.user_id = auth.uid()
       and cu.is_active
       and (p_roles is null or cu.role = any (p_roles))
  );
$$;

revoke all on function public.ordering_is_client_member(uuid, text[]) from public, anon;
grant execute on function public.ordering_is_client_member(uuid, text[]) to authenticated, service_role;

-- ===========================================================================
-- menus and menu_items
-- ===========================================================================
create table if not exists public.menus (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  name text not null default 'Menu',
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, client_id),
  unique (client_id, name)
);

drop trigger if exists menus_touch on public.menus;
create trigger menus_touch before update on public.menus
  for each row execute function public.ordering_touch_updated_at();

alter table public.menus enable row level security;

create table if not exists public.menu_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  menu_id uuid not null,
  slug text not null,                              -- stable per-client key for seeding
  name text not null check (length(name) between 1 and 120),
  description text not null default '',
  price_cents integer not null check (price_cents >= 0),
  category text not null default 'Menu',
  image_url text,                                  -- null = placeholder
  image_alt text,
  is_available boolean not null default true,      -- disable instead of deleting
  display_order integer not null default 0,
  is_demo boolean not null default false,          -- placeholder content, not client-approved
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, slug),
  unique (id, client_id),
  -- An item can only sit on a menu that belongs to the same client.
  foreign key (menu_id, client_id) references public.menus (id, client_id) on delete cascade
);

create index if not exists menu_items_client_idx on public.menu_items (client_id, display_order);

drop trigger if exists menu_items_touch on public.menu_items;
create trigger menu_items_touch before update on public.menu_items
  for each row execute function public.ordering_touch_updated_at();

alter table public.menu_items enable row level security;

-- ===========================================================================
-- client_orders, client_order_items, order_payments, client_order_events
-- ===========================================================================
create sequence if not exists public.client_order_number_seq start 1001;

create table if not exists public.client_orders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete restrict,
  order_number text not null,
  idempotency_key text not null,
  request_fingerprint text not null,
  source text not null check (source in ('online', 'staff')),
  created_by uuid references auth.users (id),      -- staff member for staff orders
  customer_name text not null,
  customer_phone text not null,
  customer_email text,
  currency text not null default 'USD',
  subtotal_cents integer not null check (subtotal_cents >= 0),
  tax_cents integer not null default 0 check (tax_cents >= 0),
  fees_cents integer not null default 0 check (fees_cents >= 0),
  total_cents integer not null check (total_cents >= 0),
  pricing_note text,
  sales_tax_rate_bp integer not null default 0,     -- rate applied when the order was placed
  sales_tax_label text,
  payment_method text not null default 'cash_app' check (payment_method in ('cash_app', 'zelle')),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'failed', 'cancelled', 'manual_review')),
  payment_reference text,
  payment_flag text check (payment_flag in ('possible_duplicate_payment', 'cancelled_after_payment')),
  paid_at timestamptz,
  order_status text not null default 'open' check (order_status in ('open', 'completed', 'cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (client_id, order_number),
  unique (client_id, idempotency_key),
  unique (id, client_id)
);

create index if not exists client_orders_status_idx on public.client_orders (client_id, payment_status, created_at desc);

drop trigger if exists client_orders_touch on public.client_orders;
create trigger client_orders_touch before update on public.client_orders
  for each row execute function public.ordering_touch_updated_at();

alter table public.client_orders enable row level security;

-- Immutable snapshot of what was ordered and at what price.
create table if not exists public.client_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  client_id uuid not null,
  menu_item_id uuid,
  position integer not null,
  name_snapshot text not null,
  unit_price_cents integer not null check (unit_price_cents >= 0),
  quantity integer not null check (quantity between 1 and 50),
  line_total_cents integer not null check (line_total_cents >= 0),
  foreign key (order_id, client_id) references public.client_orders (id, client_id) on delete cascade,
  foreign key (menu_item_id, client_id) references public.menu_items (id, client_id) on delete set null (menu_item_id)
);

create index if not exists client_order_items_order_idx on public.client_order_items (order_id);

create or replace function public.ordering_items_immutable()
returns trigger language plpgsql as $$
begin
  raise exception 'client_order_items are immutable';
end;
$$;

drop trigger if exists client_order_items_no_update on public.client_order_items;
create trigger client_order_items_no_update before update on public.client_order_items
  for each row execute function public.ordering_items_immutable();

alter table public.client_order_items enable row level security;

-- Payment records: staff-documented verifications from the client's Cash App Business account.
create table if not exists public.order_payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null,
  client_id uuid not null,
  outcome text not null check (outcome in ('verified', 'amount_mismatch', 'additional_payment')),
  method text not null check (method in ('cash_app_business_manual', 'zelle_manual')),
  expected_amount_cents integer not null,
  verified_amount_cents integer not null check (verified_amount_cents >= 0),
  transaction_reference text,
  notes text,
  verified_by uuid not null references auth.users (id),
  verified_by_name text not null,
  verified_at timestamptz not null default now(),
  foreign key (order_id, client_id) references public.client_orders (id, client_id) on delete restrict
);

-- A Cash App transaction can be applied once, to one order, within a client's account.
create unique index if not exists order_payments_reference_uniq
  on public.order_payments (client_id, lower(transaction_reference))
  where transaction_reference is not null;

alter table public.order_payments enable row level security;

create table if not exists public.client_order_events (
  id bigserial primary key,
  order_id uuid not null,
  client_id uuid not null,
  field text not null check (field in ('payment_status', 'order_status', 'payment_flag', 'created')),
  from_value text,
  to_value text,
  actor_type text not null check (actor_type in ('customer', 'staff', 'system')),
  actor_id uuid,
  actor_name text,
  reason text,
  created_at timestamptz not null default now(),
  foreign key (order_id, client_id) references public.client_orders (id, client_id) on delete cascade
);

create index if not exists client_order_events_order_idx on public.client_order_events (order_id, created_at);

alter table public.client_order_events enable row level security;

-- ===========================================================================
-- Rate limiting for public ordering endpoints (hashed visitor buckets)
-- ===========================================================================
create table if not exists public.ordering_rate_limits (
  bucket text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (bucket, window_start)
);

alter table public.ordering_rate_limits enable row level security;

-- ===========================================================================
-- Row Level Security policies (tenant isolation)
-- ===========================================================================

-- clients: public sees active establishments; members see their own; owners/managers
-- may update only the settings columns granted below.
drop policy if exists clients_public_read on public.clients;
create policy clients_public_read on public.clients
  for select to anon, authenticated using (status = 'active');

drop policy if exists clients_member_read on public.clients;
create policy clients_member_read on public.clients
  for select to authenticated using (public.ordering_is_client_member(id));

drop policy if exists clients_manager_update on public.clients;
create policy clients_manager_update on public.clients
  for update to authenticated
  using (public.ordering_is_client_member(id, array['owner', 'manager']))
  with check (public.ordering_is_client_member(id, array['owner', 'manager']));

revoke insert, update, delete on public.clients from anon, authenticated;
grant update (name, timezone, cashapp_cashtag, zelle_recipient, online_ordering_enabled) on public.clients to authenticated;

-- client_users: a user sees their own memberships; owners/managers see their client's team.
drop policy if exists client_users_read on public.client_users;
create policy client_users_read on public.client_users
  for select to authenticated
  using (user_id = auth.uid() or public.ordering_is_client_member(client_id, array['owner', 'manager']));

revoke insert, update, delete on public.client_users from anon, authenticated;

-- menus / menu_items: public reads active clients' menus; owners/managers manage their own.
drop policy if exists menus_public_read on public.menus;
create policy menus_public_read on public.menus
  for select to anon, authenticated
  using (is_active and exists (select 1 from public.clients c where c.id = client_id and c.status = 'active'));

drop policy if exists menus_member_read on public.menus;
create policy menus_member_read on public.menus
  for select to authenticated using (public.ordering_is_client_member(client_id));

drop policy if exists menus_manager_insert on public.menus;
create policy menus_manager_insert on public.menus
  for insert to authenticated
  with check (public.ordering_is_client_member(client_id, array['owner', 'manager']));

drop policy if exists menus_manager_update on public.menus;
create policy menus_manager_update on public.menus
  for update to authenticated
  using (public.ordering_is_client_member(client_id, array['owner', 'manager']))
  with check (public.ordering_is_client_member(client_id, array['owner', 'manager']));

revoke delete on public.menus from anon, authenticated;

drop policy if exists menu_items_public_read on public.menu_items;
create policy menu_items_public_read on public.menu_items
  for select to anon, authenticated
  using (exists (
    select 1 from public.menus m join public.clients c on c.id = m.client_id
     where m.id = menu_id and m.is_active and c.status = 'active'
  ));

drop policy if exists menu_items_member_read on public.menu_items;
create policy menu_items_member_read on public.menu_items
  for select to authenticated using (public.ordering_is_client_member(client_id));

drop policy if exists menu_items_manager_insert on public.menu_items;
create policy menu_items_manager_insert on public.menu_items
  for insert to authenticated
  with check (public.ordering_is_client_member(client_id, array['owner', 'manager']));

drop policy if exists menu_items_manager_update on public.menu_items;
create policy menu_items_manager_update on public.menu_items
  for update to authenticated
  using (public.ordering_is_client_member(client_id, array['owner', 'manager']))
  with check (public.ordering_is_client_member(client_id, array['owner', 'manager']));

revoke delete on public.menu_items from anon, authenticated;

-- Orders, items, payments, events: members of the owning client may read.
-- No insert/update/delete policies — writes only via the ordering_* functions.
drop policy if exists client_orders_member_read on public.client_orders;
create policy client_orders_member_read on public.client_orders
  for select to authenticated using (public.ordering_is_client_member(client_id));

drop policy if exists client_order_items_member_read on public.client_order_items;
create policy client_order_items_member_read on public.client_order_items
  for select to authenticated using (public.ordering_is_client_member(client_id));

drop policy if exists order_payments_member_read on public.order_payments;
create policy order_payments_member_read on public.order_payments
  for select to authenticated using (public.ordering_is_client_member(client_id));

drop policy if exists client_order_events_member_read on public.client_order_events;
create policy client_order_events_member_read on public.client_order_events
  for select to authenticated using (public.ordering_is_client_member(client_id));

revoke insert, update, delete on public.client_orders, public.client_order_items,
  public.order_payments, public.client_order_events from anon, authenticated;
revoke all on public.ordering_rate_limits from anon, authenticated;

-- ===========================================================================
-- ordering_create_order: the only way orders are created (online and staff).
-- The client comes from the server's configuration, never the browser. Every
-- item must belong to that client and sit on an active menu; prices come from
-- menu_items. Idempotent per client on p_idempotency_key.
-- p_items: [{"menu_item_id": "<uuid>", "quantity": <int>}, ...]
-- ===========================================================================
create or replace function public.ordering_create_order(
  p_client_id uuid,
  p_idempotency_key text,
  p_fingerprint text,
  p_source text,
  p_staff uuid,
  p_customer_name text,
  p_customer_phone text,
  p_customer_email text,
  p_items jsonb,
  p_payment_method text
) returns table (order_id uuid, created boolean)
language plpgsql as $$
declare
  v_client public.clients%rowtype;
  v_existing record;
  v_order_id uuid;
  v_subtotal integer := 0;
  v_lines jsonb;
  -- Order limits for a quick-service shop. Online orders stay within what the
  -- counter can take without a heads-up; bigger orders go through staff.
  v_max_qty integer := case when p_source = 'staff' then 50 else 15 end;          -- per item
  v_max_items integer := case when p_source = 'staff' then 150 else 40 end;       -- whole order
  v_max_total integer := case when p_source = 'staff' then 100000 else 25000 end; -- cents ($1,000 / $250)
  v_max_open_per_phone integer := 3;                                              -- unpaid online orders
  v_item_count integer;
  v_tax integer := 0;
begin
  if p_source not in ('online', 'staff') then
    raise exception 'invalid_source' using errcode = 'P0001';
  end if;

  select * into v_client from public.clients where id = p_client_id for share;
  if not found or v_client.status <> 'active' then
    raise exception 'client_unavailable' using errcode = 'P0001';
  end if;
  if p_source = 'online' and not v_client.online_ordering_enabled then
    raise exception 'ordering_disabled' using errcode = 'P0001';
  end if;
  if p_source = 'staff' and not exists (
    select 1 from public.client_users cu
     where cu.client_id = p_client_id and cu.user_id = p_staff and cu.is_active
  ) then
    raise exception 'not_client_staff' using errcode = 'P0001';
  end if;
  if p_source = 'online' and p_staff is not null then
    raise exception 'invalid_source' using errcode = 'P0001';
  end if;
  -- Only payment methods this client has configured can be chosen.
  if not ((p_payment_method = 'cash_app' and v_client.cashapp_cashtag is not null)
       or (p_payment_method = 'zelle' and v_client.zelle_recipient is not null)) then
    raise exception 'payment_method_unavailable' using errcode = 'P0001';
  end if;

  select o.id, o.request_fingerprint into v_existing
    from public.client_orders o
   where o.client_id = p_client_id and o.idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_fingerprint <> p_fingerprint then
      raise exception 'idempotency_key_reused' using errcode = 'P0001';
    end if;
    return query select v_existing.id, false;
    return;
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'empty_order' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_items) > 20 then
    raise exception 'too_many_lines' using errcode = 'P0001';
  end if;

  -- Merge duplicate lines into one per menu item.
  select jsonb_agg(jsonb_build_object('menu_item_id', s.menu_item_id, 'quantity', s.quantity))
    into v_lines
    from (
      select (elem->>'menu_item_id')::uuid as menu_item_id, sum((elem->>'quantity')::integer) as quantity
        from jsonb_array_elements(p_items) elem
       group by 1
    ) s;

  if exists (
    select 1 from jsonb_to_recordset(v_lines) as l(menu_item_id uuid, quantity integer)
     where l.quantity is null or l.quantity < 1 or l.quantity > v_max_qty
  ) then
    raise exception 'invalid_quantity' using errcode = 'P0001';
  end if;

  select coalesce(sum(l.quantity), 0)::integer into v_item_count
    from jsonb_to_recordset(v_lines) as l(menu_item_id uuid, quantity integer);
  if v_item_count > v_max_items then
    raise exception 'order_too_large' using errcode = 'P0001';
  end if;

  if p_source = 'online' and (
    select count(*) from public.client_orders o
     where o.client_id = p_client_id
       and o.source = 'online'
       and o.order_status = 'open'
       and o.payment_status in ('pending', 'manual_review')
       and regexp_replace(o.customer_phone, '\D', '', 'g') = regexp_replace(p_customer_phone, '\D', '', 'g')
  ) >= v_max_open_per_phone then
    raise exception 'too_many_open_orders' using errcode = 'P0001';
  end if;

  -- Lock this client's menu rows so a concurrent price/availability change
  -- can't slip between the check and the insert.
  perform 1 from public.menu_items m
   where m.client_id = p_client_id
     and m.id in (select l.menu_item_id from jsonb_to_recordset(v_lines) as l(menu_item_id uuid, quantity integer))
     for share;

  -- Every item must exist, belong to THIS client, be available and be on an active menu.
  if exists (
    select 1 from jsonb_to_recordset(v_lines) as l(menu_item_id uuid, quantity integer)
      left join public.menu_items m on m.id = l.menu_item_id and m.client_id = p_client_id
      left join public.menus mn on mn.id = m.menu_id and mn.client_id = p_client_id
     where m.id is null or not m.is_available or mn.id is null or not mn.is_active
  ) then
    raise exception 'item_unavailable' using errcode = 'P0001';
  end if;

  select coalesce(sum(m.price_cents * l.quantity), 0)::integer into v_subtotal
    from jsonb_to_recordset(v_lines) as l(menu_item_id uuid, quantity integer)
    join public.menu_items m on m.id = l.menu_item_id and m.client_id = p_client_id;

  if v_subtotal > v_max_total then
    raise exception 'order_too_large' using errcode = 'P0001';
  end if;

  -- Florida s.212.12(10): carry tax to the third decimal place (tenth of a
  -- cent) and round up to the next cent when that digit is greater than 4;
  -- applied once to the invoice's taxable total. In integer cents:
  -- tax = floor((subtotal_cents * rate_bp + 5000) / 10000).
  v_tax := ((v_subtotal::bigint * v_client.sales_tax_rate_bp + 5000) / 10000)::integer;

  begin
    insert into public.client_orders (
      client_id, order_number, idempotency_key, request_fingerprint, source, created_by,
      customer_name, customer_phone, customer_email,
      subtotal_cents, tax_cents, fees_cents, total_cents, pricing_note, payment_method,
      sales_tax_rate_bp, sales_tax_label
    ) values (
      p_client_id,
      v_client.order_number_prefix || '-' || nextval('public.client_order_number_seq')::text,
      p_idempotency_key, p_fingerprint, p_source, p_staff,
      p_customer_name, p_customer_phone, nullif(p_customer_email, ''),
      v_subtotal, v_tax, 0, v_subtotal + v_tax,
      case when v_client.sales_tax_rate_bp = 0 then 'No sales tax configured for this restaurant.' end,
      p_payment_method,
      v_client.sales_tax_rate_bp, v_client.sales_tax_label
    ) returning id into v_order_id;
  exception when unique_violation then
    -- A concurrent retry with the same key won the race; return its order.
    select o.id, o.request_fingerprint into v_existing
      from public.client_orders o
     where o.client_id = p_client_id and o.idempotency_key = p_idempotency_key;
    if v_existing.request_fingerprint <> p_fingerprint then
      raise exception 'idempotency_key_reused' using errcode = 'P0001';
    end if;
    return query select v_existing.id, false;
    return;
  end;

  insert into public.client_order_items (
    order_id, client_id, menu_item_id, position, name_snapshot, unit_price_cents, quantity, line_total_cents
  )
  select v_order_id, p_client_id, m.id, row_number() over (order by m.display_order, m.name)::integer,
         m.name, m.price_cents, l.quantity, m.price_cents * l.quantity
    from jsonb_to_recordset(v_lines) as l(menu_item_id uuid, quantity integer)
    join public.menu_items m on m.id = l.menu_item_id and m.client_id = p_client_id;

  insert into public.client_order_events (order_id, client_id, field, to_value, actor_type, actor_id)
  values (v_order_id, p_client_id, 'created', p_source,
          case when p_source = 'staff' then 'staff' else 'customer' end, p_staff);

  return query select v_order_id, true;
end;
$$;

-- ===========================================================================
-- ordering_record_payment: staff documents a payment found in the client's
-- Cash App Business account. Paid only when the verified amount equals the
-- order total; otherwise manual_review. The staff member must be an active
-- member of the order's client. p_additional records a second payment on an
-- already-paid order and flags a possible duplicate (no automatic refund).
-- ===========================================================================
create or replace function public.ordering_record_payment(
  p_client_id uuid,
  p_order_id uuid,
  p_verified_amount_cents integer,
  p_reference text,
  p_notes text,
  p_staff uuid,
  p_staff_name text,
  p_method text,
  p_additional boolean default false
) returns jsonb
language plpgsql as $$
declare
  v_order public.client_orders%rowtype;
  v_ref text := nullif(btrim(p_reference), '');
  v_outcome text;
  v_method text := case p_method when 'cash_app' then 'cash_app_business_manual' when 'zelle' then 'zelle_manual' end;
begin
  if v_method is null then
    raise exception 'invalid_method' using errcode = 'P0001';
  end if;
  if not exists (
    select 1 from public.client_users cu
     where cu.client_id = p_client_id and cu.user_id = p_staff and cu.is_active
  ) then
    raise exception 'not_client_staff' using errcode = 'P0001';
  end if;

  select * into v_order from public.client_orders
   where id = p_order_id and client_id = p_client_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;
  if p_verified_amount_cents is null or p_verified_amount_cents < 0 then
    raise exception 'invalid_amount' using errcode = 'P0001';
  end if;

  if v_ref is not null and exists (
    select 1 from public.order_payments p
     where p.client_id = p_client_id and lower(p.transaction_reference) = lower(v_ref)
  ) then
    if exists (
      select 1 from public.order_payments p
       where p.client_id = p_client_id and lower(p.transaction_reference) = lower(v_ref)
         and p.order_id = p_order_id
    ) then
      return jsonb_build_object('result', 'already_recorded');
    end if;
    raise exception 'reference_used_on_other_order' using errcode = 'P0001';
  end if;

  if v_order.payment_status = 'paid' then
    if not p_additional then
      return jsonb_build_object('result', 'already_paid');
    end if;
    v_outcome := 'additional_payment';
  elsif v_order.order_status = 'cancelled' then
    raise exception 'order_cancelled' using errcode = 'P0001';
  elsif p_additional then
    raise exception 'not_paid_yet' using errcode = 'P0001';
  elsif p_verified_amount_cents = v_order.total_cents then
    v_outcome := 'verified';
  else
    v_outcome := 'amount_mismatch';
  end if;

  insert into public.order_payments (
    order_id, client_id, outcome, method, expected_amount_cents, verified_amount_cents,
    transaction_reference, notes, verified_by, verified_by_name
  ) values (
    p_order_id, p_client_id, v_outcome, v_method, v_order.total_cents, p_verified_amount_cents,
    v_ref, nullif(btrim(p_notes), ''), p_staff, p_staff_name
  );

  if v_outcome = 'verified' then
    update public.client_orders
       set payment_status = 'paid', paid_at = now(), payment_reference = v_ref, payment_method = p_method
     where id = p_order_id;
    insert into public.client_order_events (order_id, client_id, field, from_value, to_value, actor_type, actor_id, actor_name, reason)
    values (p_order_id, p_client_id, 'payment_status', v_order.payment_status, 'paid', 'staff', p_staff, p_staff_name,
            case when p_method = 'zelle' then 'Zelle payment located in the business bank account and verified by staff'
                 else 'Payment located in Cash App Business account and verified by staff' end);
  elsif v_outcome = 'amount_mismatch' then
    if v_order.payment_status <> 'manual_review' then
      update public.client_orders set payment_status = 'manual_review' where id = p_order_id;
      insert into public.client_order_events (order_id, client_id, field, from_value, to_value, actor_type, actor_id, actor_name, reason)
      values (p_order_id, p_client_id, 'payment_status', v_order.payment_status, 'manual_review', 'staff', p_staff,
              p_staff_name, 'Verified amount does not match order total');
    end if;
  else
    if v_order.payment_flag is distinct from 'possible_duplicate_payment' then
      update public.client_orders set payment_flag = 'possible_duplicate_payment' where id = p_order_id;
      insert into public.client_order_events (order_id, client_id, field, from_value, to_value, actor_type, actor_id, actor_name, reason)
      values (p_order_id, p_client_id, 'payment_flag', v_order.payment_flag, 'possible_duplicate_payment', 'staff',
              p_staff, p_staff_name, 'Additional payment recorded on an already-paid order');
    end if;
  end if;

  return jsonb_build_object('result', v_outcome);
end;
$$;

-- ===========================================================================
-- ordering_order_action: manual review, back to pending, cancel, complete.
-- Cancelling a PAID order requires an owner or manager.
-- ===========================================================================
create or replace function public.ordering_order_action(
  p_client_id uuid,
  p_order_id uuid,
  p_action text,
  p_reason text,
  p_staff uuid,
  p_staff_name text
) returns jsonb
language plpgsql as $$
declare
  v_order public.client_orders%rowtype;
  v_role text;
  v_reason text := nullif(btrim(p_reason), '');
begin
  select cu.role into v_role from public.client_users cu
   where cu.client_id = p_client_id and cu.user_id = p_staff and cu.is_active;
  if v_role is null then
    raise exception 'not_client_staff' using errcode = 'P0001';
  end if;

  select * into v_order from public.client_orders
   where id = p_order_id and client_id = p_client_id for update;
  if not found then
    raise exception 'order_not_found' using errcode = 'P0001';
  end if;

  if p_action = 'manual_review' then
    if v_order.payment_status <> 'pending' or v_order.order_status <> 'open' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.client_orders set payment_status = 'manual_review' where id = p_order_id;
    insert into public.client_order_events (order_id, client_id, field, from_value, to_value, actor_type, actor_id, actor_name, reason)
    values (p_order_id, p_client_id, 'payment_status', 'pending', 'manual_review', 'staff', p_staff, p_staff_name, v_reason);

  elsif p_action = 'return_to_pending' then
    if v_order.payment_status <> 'manual_review' or v_order.order_status <> 'open' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.client_orders set payment_status = 'pending' where id = p_order_id;
    insert into public.client_order_events (order_id, client_id, field, from_value, to_value, actor_type, actor_id, actor_name, reason)
    values (p_order_id, p_client_id, 'payment_status', 'manual_review', 'pending', 'staff', p_staff, p_staff_name, v_reason);

  elsif p_action = 'cancel' then
    if v_order.order_status <> 'open' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    if v_reason is null then
      raise exception 'reason_required' using errcode = 'P0001';
    end if;
    if v_order.payment_status = 'paid' and v_role not in ('owner', 'manager') then
      raise exception 'manager_required' using errcode = 'P0001';
    end if;
    update public.client_orders set order_status = 'cancelled' where id = p_order_id;
    insert into public.client_order_events (order_id, client_id, field, from_value, to_value, actor_type, actor_id, actor_name, reason)
    values (p_order_id, p_client_id, 'order_status', 'open', 'cancelled', 'staff', p_staff, p_staff_name, v_reason);
    if v_order.payment_status in ('pending', 'manual_review') then
      update public.client_orders set payment_status = 'cancelled' where id = p_order_id;
      insert into public.client_order_events (order_id, client_id, field, from_value, to_value, actor_type, actor_id, actor_name, reason)
      values (p_order_id, p_client_id, 'payment_status', v_order.payment_status, 'cancelled', 'staff', p_staff, p_staff_name, v_reason);
    elsif v_order.payment_status = 'paid' then
      update public.client_orders set payment_flag = 'cancelled_after_payment' where id = p_order_id;
      insert into public.client_order_events (order_id, client_id, field, from_value, to_value, actor_type, actor_id, actor_name, reason)
      values (p_order_id, p_client_id, 'payment_flag', v_order.payment_flag, 'cancelled_after_payment', 'staff', p_staff,
              p_staff_name, v_reason);
    end if;

  elsif p_action = 'complete' then
    if v_order.order_status <> 'open' or v_order.payment_status <> 'paid' then
      raise exception 'invalid_transition' using errcode = 'P0001';
    end if;
    update public.client_orders set order_status = 'completed' where id = p_order_id;
    insert into public.client_order_events (order_id, client_id, field, from_value, to_value, actor_type, actor_id, actor_name, reason)
    values (p_order_id, p_client_id, 'order_status', 'open', 'completed', 'staff', p_staff, p_staff_name, v_reason);

  else
    raise exception 'unknown_action' using errcode = 'P0001';
  end if;

  return jsonb_build_object('result', 'ok');
end;
$$;

-- ===========================================================================
-- ordering_hit_rate_limit: fixed-window counter. Returns true if within limit.
-- ===========================================================================
create or replace function public.ordering_hit_rate_limit(p_bucket text, p_window_seconds integer, p_limit integer)
returns boolean
language plpgsql as $$
declare
  v_start timestamptz := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_hits integer;
begin
  insert into public.ordering_rate_limits as r (bucket, window_start, hits)
  values (p_bucket, v_start, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;

  if random() < 0.02 then
    delete from public.ordering_rate_limits where window_start < now() - interval '1 day';
  end if;

  return v_hits <= p_limit;
end;
$$;

-- ===========================================================================
-- ordering_onboard_client: add an establishment to the shared tables.
-- Creates (or returns) the clients row and a default menu, and optionally
-- links the owner's existing auth user. No project, database or tables are
-- created. Idempotent on slug: re-running never changes an existing client.
-- ===========================================================================
create or replace function public.ordering_onboard_client(
  p_slug text,
  p_name text,
  p_order_number_prefix text,
  p_owner_user_id uuid default null,
  p_owner_name text default null,
  p_timezone text default 'America/New_York'
) returns uuid
language plpgsql as $$
declare
  v_client_id uuid;
begin
  insert into public.clients (slug, name, order_number_prefix, timezone)
  values (p_slug, p_name, p_order_number_prefix, p_timezone)
  on conflict (slug) do nothing;

  select id into v_client_id from public.clients where slug = p_slug;

  insert into public.menus (client_id, name)
  values (v_client_id, 'Menu')
  on conflict (client_id, name) do nothing;

  if p_owner_user_id is not null then
    insert into public.client_users (client_id, user_id, role, display_name)
    values (v_client_id, p_owner_user_id, 'owner', coalesce(nullif(btrim(p_owner_name), ''), 'Owner'))
    on conflict (client_id, user_id) do nothing;
  end if;

  return v_client_id;
end;
$$;

-- Only the server (service role) may call the write functions.
revoke all on function public.ordering_create_order(uuid, text, text, text, uuid, text, text, text, jsonb, text) from public, anon, authenticated;
revoke all on function public.ordering_record_payment(uuid, uuid, integer, text, text, uuid, text, text, boolean) from public, anon, authenticated;
revoke all on function public.ordering_order_action(uuid, uuid, text, text, uuid, text) from public, anon, authenticated;
revoke all on function public.ordering_hit_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.ordering_onboard_client(text, text, text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.ordering_create_order(uuid, text, text, text, uuid, text, text, text, jsonb, text) to service_role;
grant execute on function public.ordering_record_payment(uuid, uuid, integer, text, text, uuid, text, text, boolean) to service_role;
grant execute on function public.ordering_order_action(uuid, uuid, text, text, uuid, text) to service_role;
grant execute on function public.ordering_hit_rate_limit(text, integer, integer) to service_role;
grant execute on function public.ordering_onboard_client(text, text, text, uuid, text, text) to service_role;

-- ===========================================================================
-- Seed: onboard the two current establishments into the shared tables.
-- * Zaddys: active, with three DEMO items (placeholders needing client
--   approval). Online ordering stays OFF until the client approves.
-- * Blue Flame: onboarding only, no menu items (none have been supplied).
-- No owners are linked here — add them with ordering_onboard_client or an
-- insert into client_users once their auth users exist.
-- ===========================================================================
select public.ordering_onboard_client('zaddys', 'Zaddys Subs & Deli Shop', 'Z');
update public.clients set status = 'active' where slug = 'zaddys' and status = 'onboarding';
-- Payment details supplied by the client.
update public.clients set cashapp_cashtag = '$zaddysintampa' where slug = 'zaddys' and cashapp_cashtag is null;
update public.clients set zelle_recipient = 'zaddysintampa@gmail.com' where slug = 'zaddys' and zelle_recipient is null;
-- Tampa / Hillsborough County: 6% Florida sales tax + 1.5% Hillsborough discretionary
-- surtax = 7.5% (Florida DOR DR-15DSS; both expiring half-cents already extended).
update public.clients
   set sales_tax_rate_bp = 750,
       sales_tax_label = 'FL sales tax 7.5% (6% state + 1.5% Hillsborough County)'
 where slug = 'zaddys' and sales_tax_rate_bp = 0;

insert into public.menu_items (client_id, menu_id, slug, name, description, price_cents, category, display_order, is_demo)
select c.id, m.id, v.slug, v.name, v.description, v.price_cents, v.category, v.display_order, true
  from public.clients c
  join public.menus m on m.client_id = c.id and m.name = 'Menu'
 cross join (values
   ('classic-burger', 'Classic Burger', 'Demo item — placeholder description pending client approval.', 899, 'Mains', 10),
   ('chicken-sandwich', 'Chicken Sandwich', 'Demo item — placeholder description pending client approval.', 849, 'Mains', 20),
   ('french-fries', 'French Fries', 'Demo item — placeholder description pending client approval.', 349, 'Sides', 30)
 ) as v (slug, name, description, price_cents, category, display_order)
 where c.slug = 'zaddys'
on conflict (client_id, slug) do nothing;

select public.ordering_onboard_client('blue-flame', 'Blue Flame Southern Restaurant & Lounge', 'BF');
