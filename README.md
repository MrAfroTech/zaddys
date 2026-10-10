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

- **Photos:** upload to `public/images/`, then reference them in
  `src/data/photos.js` and `src/data/slides.js`. Marked placeholders show
  until then.
- **Logo:** add the official file at `public/images/logo.png` and set
  `LOGO_SRC` in `src/components/BrandMark.jsx`. Never recolor it.
- **Hours:** not supplied yet — the site says "Call for hours" until
  `src/data/hours.js` is filled in.
- **Full menu:** only the flyer items are listed so far.
- **Online ordering:** none known, so ordering is "Call to order"
  (813-982-3922). Set `ordering` in `src/data/restaurant.js` if there's a link.
- **Colors:** sampled from photos of the sign and flyer, so they're close but
  not exact. Swap in exact values if Zaddys has a brand guide.
