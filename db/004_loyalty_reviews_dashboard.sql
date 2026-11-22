-- ===========================================================================
-- 004: loyalty rewards, Google review requests, owner sales dashboard.
--
-- Run AFTER db/003. Additive and idempotent; nothing is dropped.
--
-- * Loyalty: every paid order counts once toward the customer's reward
--   ("every Nth order"). Staff redeem the reward at the counter; the count
--   drops by N. Off until the client sets loyalty_enabled + loyalty_reward.
-- * Review requests: after staff complete an order, customers who chose
--   email updates get one "How was it?" email linking to the client's Google
--   review page. Off until review_requests_enabled + google_review_url.
-- * Sales summary: one server-only function the owner dashboard calls.
-- ===========================================================================

-- ---------------------------------------------------------------- clients
alter table public.clients
  add column if not exists loyalty_enabled boolean not null default false,
  add column if not exists loyalty_orders_required integer not null default 10
    check (loyalty_orders_required between 2 and 50),
  -- What the customer earns, as shown to them, e.g. 'a free 6" sub'.
  add column if not exists loyalty_reward text check (loyalty_reward is null or length(loyalty_reward) between 3 and 80),
  add column if not exists review_requests_enabled boolean not null default false,
  -- The client's Google "write a review" link (Google Business Profile → Ask for reviews).
  add column if not exists google_review_url text
    check (google_review_url is null or google_review_url ~ '^https://(g\.page/|www\.google\.com/|search\.google\.com/|maps\.app\.goo\.gl/)');

-- ------------------------------------------------------- client_customers
alter table public.client_customers
  -- Paid orders counted toward the next reward (reduced on redemption).
  add column if not exists loyalty_points integer not null default 0 check (loyalty_points >= 0),
  add column if not exists rewards_redeemed integer not null default 0,
  add column if not exists last_reward_redeemed_at timestamptz;

-- ---------------------------------------------------------- client_orders
alter table public.client_orders
  add column if not exists loyalty_counted boolean not null default false,
  add column if not exists reward_redeemed_at timestamptz,
  add column if not exists reward_redeemed_by_name text;

-- History: allow loyalty events next to the existing ones (keeps 003's).
alter table public.client_order_events drop constraint if exists client_order_events_field_check;
alter table public.client_order_events add constraint client_order_events_field_check
  check (field in ('payment_status', 'order_status', 'payment_flag', 'created', 'zelle_request', 'loyalty'));

-- Messages: allow the review request.
alter table public.client_notifications drop constraint if exists client_notifications_kind_check;
alter table public.client_notifications add constraint client_notifications_kind_check
  check (kind in ('order_placed', 'payment_confirmed', 'order_cancelled', 'review_request'));

-- ------------------------------------------------- ordering_loyalty_on_paid
-- Counts a paid order toward its customer's reward, once. Safe to repeat.
-- Returns the customer's points after counting (null if nothing counted).
create or replace function public.ordering_loyalty_on_paid(p_client_id uuid, p_order_id uuid)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_order public.client_orders%rowtype;
  v_points integer;
begin
  select * into v_order from public.client_orders
   where id = p_order_id and client_id = p_client_id
   for update;
  if not found or v_order.loyalty_counted or v_order.customer_id is null
     or v_order.payment_status <> 'paid' or v_order.order_status = 'cancelled' then
    return null;
  end if;
  if not exists (select 1 from public.clients where id = p_client_id and loyalty_enabled) then
    return null;
  end if;

  update public.client_orders set loyalty_counted = true where id = p_order_id;
  update public.client_customers
     set loyalty_points = loyalty_points + 1
   where id = v_order.customer_id and client_id = p_client_id
  returning loyalty_points into v_points;
  insert into public.client_order_events (order_id, client_id, field, from_value, to_value, actor_type)
  values (p_order_id, p_client_id, 'loyalty', null, 'counted:' || v_points, 'system');
  return v_points;
end;
$$;

-- --------------------------------------------------- ordering_redeem_reward
-- Staff redeem the customer's reward on an open order. Requires enough
-- points; deducts loyalty_orders_required. Returns points left.
create or replace function public.ordering_redeem_reward(
  p_client_id uuid, p_order_id uuid, p_staff uuid, p_staff_name text
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_order public.client_orders%rowtype;
  v_required integer;
  v_points integer;
begin
  if p_staff is null or not exists (
    select 1 from public.client_users cu
     where cu.client_id = p_client_id and cu.user_id = p_staff and cu.is_active) then
    raise exception 'not_client_staff';
  end if;
  select loyalty_orders_required into v_required
    from public.clients where id = p_client_id and loyalty_enabled;
  if v_required is null then
    raise exception 'loyalty_disabled';
  end if;

  select * into v_order from public.client_orders
   where id = p_order_id and client_id = p_client_id
   for update;
  if not found then
    raise exception 'order_not_found';
  end if;
  if v_order.reward_redeemed_at is not null then
    raise exception 'reward_already_redeemed';
  end if;
  if v_order.order_status = 'cancelled' or v_order.customer_id is null then
    raise exception 'reward_not_available';
  end if;

  update public.client_customers
     set loyalty_points = loyalty_points - v_required,
         rewards_redeemed = rewards_redeemed + 1,
         last_reward_redeemed_at = now()
   where id = v_order.customer_id and client_id = p_client_id and loyalty_points >= v_required
  returning loyalty_points into v_points;
  if v_points is null then
    raise exception 'reward_not_available';
  end if;

  update public.client_orders
     set reward_redeemed_at = now(), reward_redeemed_by_name = p_staff_name
   where id = p_order_id;
  insert into public.client_order_events (order_id, client_id, field, from_value, to_value, actor_type, actor_id, actor_name)
  values (p_order_id, p_client_id, 'loyalty', null, 'redeemed', 'staff', p_staff, p_staff_name);
  return v_points;
end;
$$;

-- ---------------------------------------------------- ordering_sales_summary
-- Owner dashboard numbers for [p_from, p_to). "Sales" = orders marked paid
-- (open or completed), by paid_at. Days are in the client's timezone.
create or replace function public.ordering_sales_summary(p_client_id uuid, p_from timestamptz, p_to timestamptz)
returns jsonb
language sql stable security definer set search_path = public as $$
  with c as (select id, timezone from public.clients where id = p_client_id),
  paid as (
    select o.* from public.client_orders o, c
     where o.client_id = c.id and o.payment_status = 'paid'
       and o.paid_at >= p_from and o.paid_at < p_to
  ),
  placed as (
    select o.* from public.client_orders o, c
     where o.client_id = c.id and o.created_at >= p_from and o.created_at < p_to
  ),
  first_order as (
    select customer_id, min(created_at) as first_at
      from public.client_orders
     where client_id = p_client_id and customer_id is not null and order_status <> 'cancelled'
     group by customer_id
  )
  select jsonb_build_object(
    'salesCents', coalesce((select sum(total_cents) from paid), 0),
    'subtotalCents', coalesce((select sum(subtotal_cents) from paid), 0),
    'taxCents', coalesce((select sum(tax_cents) from paid), 0),
    'paidOrders', (select count(*) from paid),
    'avgTicketCents', coalesce((select round(avg(total_cents)) from paid), 0),
    'ordersPlaced', (select count(*) from placed),
    'cancelledOrders', (select count(*) from placed where order_status = 'cancelled'),
    'awaitingPayment', (select count(*) from public.client_orders
                          where client_id = p_client_id and order_status = 'open'
                            and payment_status in ('pending', 'manual_review')),
    'customers', (select count(distinct customer_id) from paid where customer_id is not null),
    'newCustomers', (select count(distinct p.customer_id) from paid p join first_order f using (customer_id)
                      where f.first_at >= p_from and f.first_at < p_to),
    'rewardsRedeemed', (select count(*) from public.client_orders
                          where client_id = p_client_id and reward_redeemed_at >= p_from and reward_redeemed_at < p_to),
    'bySource', coalesce((select jsonb_object_agg(source, jsonb_build_object('orders', n, 'cents', cents))
                            from (select source, count(*) n, sum(total_cents) cents from paid group by source) s), '{}'::jsonb),
    'byMethod', coalesce((select jsonb_object_agg(payment_method, jsonb_build_object('orders', n, 'cents', cents))
                            from (select payment_method, count(*) n, sum(total_cents) cents from paid group by payment_method) m), '{}'::jsonb),
    'byDay', coalesce((select jsonb_agg(jsonb_build_object('day', day, 'orders', n, 'cents', cents) order by day)
                         from (select to_char(paid_at at time zone (select timezone from c), 'YYYY-MM-DD') as day,
                                      count(*) n, sum(total_cents) cents
                                 from paid group by 1) d), '[]'::jsonb),
    'topItems', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'quantity', qty, 'cents', cents) order by qty desc, cents desc)
                            from (select i.name_snapshot as name, sum(i.quantity) qty, sum(i.line_total_cents) cents
                                    from public.client_order_items i join paid p on p.id = i.order_id and p.client_id = i.client_id
                                   group by i.name_snapshot order by 2 desc, 3 desc limit 10) t), '[]'::jsonb)
  );
$$;

revoke all on function public.ordering_loyalty_on_paid(uuid, uuid) from public, anon, authenticated;
revoke all on function public.ordering_redeem_reward(uuid, uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.ordering_sales_summary(uuid, timestamptz, timestamptz) from public, anon, authenticated;
grant execute on function public.ordering_loyalty_on_paid(uuid, uuid) to service_role;
grant execute on function public.ordering_redeem_reward(uuid, uuid, uuid, text) to service_role;
grant execute on function public.ordering_sales_summary(uuid, timestamptz, timestamptz) to service_role;
