/**
 * Zaddys business information, taken from the shop sign and the
 * "Now Open" flyer. Nothing is invented: unknown values are null and the UI
 * leaves them out.
 */
export const restaurant = {
  name: 'Zaddys',
  fullName: 'Zaddys Subs & Deli Shop',
  tagline: 'Subs & Deli Shop',
  intro: 'Now open on E. Hillsborough Ave in Tampa.',
  address: {
    street: '2001 E. Hillsborough Ave Unit 6',
    city: 'Tampa',
    state: 'FL',
    zip: '33610',
  },
  phone: '813-982-3922',
  phoneHref: 'tel:+18139823922',
  email: null,
  directionsUrl:
    'https://www.google.com/maps/dir/?api=1&destination=' +
    encodeURIComponent('Zaddys Subs & Deli Shop, 2001 E. Hillsborough Ave Unit 6, Tampa, FL 33610'),
};

/**
 * How guests order. No online ordering link is known yet, so ordering is a
 * phone call. TODO(zaddys): set `url` to the online ordering link (and
 * `external: true`) if Zaddys has one.
 */
export const ordering = {
  url: restaurant.phoneHref,
  label: 'Call to order',
  external: false,
};

/** Props for any "order" link: opens a new tab only for external links. */
export const orderLinkProps = ordering.external
  ? { href: ordering.url, target: '_blank', rel: 'noopener' }
  : { href: ordering.url };
