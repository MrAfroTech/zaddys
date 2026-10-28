# Zaddys Subs & Deli Shop

Website for Zaddys Subs & Deli Shop (2001 E. Hillsborough Ave Unit 6, Tampa),
built from the Blue Flame site template: Vite + React 18, minimal path routing,
one plain CSS file, content in data modules, Vercel hosting.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # outputs dist/
```

## Where things live

| What | File |
| --- | --- |
| Brand colors (sampled from the sign and flyer) and their metallic finishes (`--metal-*`) | `src/styles.css` (`:root`) |
| Fonts (self-hosted Anton + DM Sans via @fontsource) | `src/main.jsx`, `--font-*` in `src/styles.css` |
| Menu and prices (from the "Now Open" flyer) | `src/data/menu.js` |
| Featured items | `src/data/featured.js` |
| Opening hours — the only place to edit them | `src/data/hours.js` |
| Address, phone, ordering | `src/data/restaurant.js` |
| Photos (files in `public/images/`) | `src/data/photos.js`, `src/data/slides.js` |

Routes: `/` (homepage) and `/menu`.

## Open items (search the code for `TODO(zaddys)`)

- **Photos:** the uploaded photos are in use (`src/data/photos.js`). They're
  small (about 200–370px wide), so the hero shows them framed over a
  soft-focus backdrop instead of full-bleed. Larger originals (1500px+ wide)
  would let them go bigger.
- **Logo:** add the official file at `public/images/logo.png` and set
  `LOGO_SRC` in `src/components/BrandMark.jsx`. Never recolor it.
- **Hours:** not supplied yet — the site says "Call for hours" until
  `src/data/hours.js` is filled in.
- **Full menu:** only the flyer items are listed so far.
- **Online ordering:** none known, so ordering is "Call to order"
  (813-982-3922). Set `ordering` in `src/data/restaurant.js` if there's a link.
- **Colors:** sampled from photos of the sign and flyer, so they're close but
  not exact. Swap in exact values if Zaddys has a brand guide.

## Online ordering (Cash App or Zelle, manual verification)

Customer ordering at `/order`, customer order status at `/order/status/<link>`,
and staff tools at `/staff`. Not linked from the site until
`VITE_ONLINE_ORDERING=true`; customer checkout is refused until the client's
`online_ordering_enabled` is true in the `clients` table.

### Shared, multi-client database

Every restaurant uses the **same Supabase project (salesMastery)** and the
**same tables**, separated by `client_id`. Never create a Supabase project,
database or per-client tables for a new restaurant.

| Table | Holds |
| --- | --- |
| `clients` | one row per establishment (slug, name, status, order-number prefix, $Cashtag, Zelle recipient, online ordering on/off) |
| `client_users` | which existing Supabase Auth users work for which client, and their role (owner / manager / order_taker) |
| `menus`, `menu_items` | each client's menus and items |
| `client_orders`, `client_order_items` | food orders and their price snapshots (`orders` is Concier's event reservations table) |
| `order_payments` | staff-verified Cash App / Zelle payments |
| `client_order_events` | audit trail of every status change |

Row Level Security: the public can read only active clients' menus; staff
can read only their own client's data; owners/managers can edit only their
own client's menus and settings. Orders and payments are written only by the
server through the `ordering_*` functions, which check that every item and
staff member belongs to the client.

This deployment serves the client in `CLIENT_SLUG` (server env), so a
customer can never place or view an order for another restaurant.

**Onboard a new restaurant** (SQL editor, salesMastery):

```sql
-- creates the clients row + a default menu; links the owner's existing auth user
select public.ordering_onboard_client('new-slug', 'Restaurant Name', 'NR', '<owner auth user id>', 'Owner Name');
-- add more staff
insert into public.client_users (client_id, user_id, role, display_name)
values ((select id from public.clients where slug = 'new-slug'), '<auth user id>', 'order_taker', 'Name');
```

Then deploy their site with `CLIENT_SLUG=new-slug`.

**Zaddys menu:** three **demo** items (Classic Burger $8.99, Chicken Sandwich
$8.49, French Fries $3.49, `is_demo = true`) that need client approval. The
display menu in `src/data/menu.js` (flyer items) is separate and unchanged.

### How payment works

At checkout the customer picks **Cash App** or **Zelle** (only methods set on
the client's row are offered; Zaddys: `$zaddysintampa` and
`zaddysintampa@gmail.com`). They see the exact amount, who to pay, and the
order number to put in the payment note. Neither Cash App (standard business
account) nor Zelle offers an API a small business can use to confirm
payments, so orders stay "awaiting payment confirmation" until a staff member
finds the payment in the business Cash App app or the bank's Zelle activity
and records it at `/staff` (method, amount, reference). The order is marked
paid only when the amount matches the total; otherwise it goes to manual
review. A transaction reference can only be used once per client. Nothing a
customer does marks an order paid.

To change payment details: update `cashapp_cashtag` / `zelle_recipient` on
the client's row (owners/managers can, for their own client only).

### Sales tax

Each client row has `sales_tax_rate_bp` (basis points) and `sales_tax_label`.
Zaddys (Tampa, Hillsborough County): **7.5%** = 6% Florida + 1.5% Hillsborough
discretionary surtax (Florida DOR form DR-15DSS). Tax is calculated in the
database on the order subtotal using Florida's rounding rule (s. 212.12(10):
carry to the third decimal, round up when it is greater than 4) and the rate
and label are saved on each order. Menu prices are pre-tax; tax is added at
checkout. Update the client row if the rate changes (DR-15DSS is republished
each November).

### Limits (quick-service sandwich shop)

| | Online | Staff-entered |
| --- | --- | --- |
| Per item | 15 | 50 |
| Items per order | 40 | 150 |
| Order subtotal (before tax) | $250 | $1,000 |
| Unpaid online orders per phone | 3 | — |
| Checkouts per visitor | 5 / 15 min | — |
| Status checks per visitor | 120 / 10 min | — |

### Pieces

| What | Where |
| --- | --- |
| Shared tables, RLS, functions, Zaddys/Blue Flame seed (idempotent, additive) | `db/schema.sql` |
| API (Vercel functions) | `api/menu.js`, `api/orders.js`, `api/order-status.js`, `api/staff/*.js` |
| Server helpers | `server/` |
| Pages | `src/pages/OrderPage.jsx`, `OrderStatusPage.jsx`, `StaffPage.jsx` |
| Settings | `.env.example` |
