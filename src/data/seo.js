/**
 * Search-engine data for the static pages written by scripts/prerender.mjs:
 * page titles/descriptions and schema.org JSON-LD (Restaurant, Menu) built
 * from the same data the site shows, so Google's copy never drifts.
 */
import { restaurant } from './restaurant';
import { menuSections } from './menu';
import { weeklyHours } from './hours';
import { photos } from './photos';

const SITE = restaurant.siteUrl;
const abs = (path) => `${SITE}${path}`;
const dollars = (cents) => (cents / 100).toFixed(2);
const pad = (h) => `${String(h).padStart(2, '0')}:00`;

function openingHours() {
  if (!Array.isArray(weeklyHours)) return undefined;
  const groups = new Map();
  for (const h of weeklyHours) {
    if (h.open == null) continue;
    const key = `${h.open}-${h.close}`;
    if (!groups.has(key)) groups.set(key, { open: h.open, close: h.close, days: [] });
    groups.get(key).days.push(h.day);
  }
  return [...groups.values()].map((g) => ({ '@type': 'OpeningHoursSpecification', dayOfWeek: g.days, opens: pad(g.open), closes: pad(g.close) }));
}

/** schema.org Menu with every section and item (one offer per size). */
export function menuJsonLd() {
  return {
    '@type': 'Menu',
    '@id': abs('/menu#menu'),
    name: `${restaurant.fullName} menu`,
    url: abs('/menu'),
    hasMenuSection: menuSections.map((s) => ({
      '@type': 'MenuSection',
      name: s.title,
      hasMenuItem: s.items.map((item) => ({
        '@type': 'MenuItem',
        name: item.name,
        ...(item.description ? { description: item.description } : {}),
        offers: item.prices.map((cents, i) => ({
          '@type': 'Offer',
          price: dollars(cents),
          priceCurrency: 'USD',
          ...(s.sizes?.length > 1 ? { name: s.sizes[i] } : {}),
        })),
      })),
    })),
  };
}

/** schema.org Restaurant, with online ordering and (optionally) the full menu. */
export function restaurantJsonLd({ withMenu = false } = {}) {
  const { address } = restaurant;
  const hours = openingHours();
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': abs('/#restaurant'),
    name: restaurant.fullName,
    alternateName: restaurant.name,
    url: abs('/'),
    telephone: `+1-${restaurant.phone}`,
    ...(restaurant.email ? { email: restaurant.email } : {}),
    image: [abs(photos.homeSubCombo.src), abs(photos.menuSpread.src)],
    servesCuisine: ['Sandwiches', 'Subs', 'Deli', 'Cuban sandwiches', 'Philly cheesesteaks'],
    priceRange: '$',
    acceptsReservations: false,
    paymentAccepted: 'Cash App, Zelle',
    address: {
      '@type': 'PostalAddress',
      streetAddress: address.street,
      addressLocality: address.city,
      addressRegion: address.state,
      postalCode: address.zip,
      addressCountry: 'US',
    },
    ...(hours ? { openingHoursSpecification: hours } : {}),
    hasMenu: withMenu ? menuJsonLd() : abs('/menu'),
    potentialAction: {
      '@type': 'OrderAction',
      target: { '@type': 'EntryPoint', urlTemplate: abs('/order'), actionPlatform: ['http://schema.org/DesktopWebPlatform', 'http://schema.org/MobileWebPlatform'] },
      deliveryMethod: 'http://purl.org/goodrelations/v1#DeliveryModePickUp',
    },
    sameAs: Object.values(restaurant.social || {}),
  };
}

/** Per-page head tags for the static pages. */
export const seoPages = {
  home: {
    path: '/',
    title: `${restaurant.fullName} | Subs, Phillys & Cubans in Tampa`,
    description: `Philly cheesesteaks, Cubans, subs and the Glizzy Deal at ${restaurant.address.street.replace(/ Unit .*/, '')}, Tampa. Order online for pickup.`,
    image: photos.homeSubCombo.src,
    jsonLd: () => restaurantJsonLd(),
  },
  menu: {
    path: '/menu',
    title: `Menu & Prices | ${restaurant.fullName}, Tampa`,
    description: `Full ${restaurant.fullName} menu with prices: Philly cheesesteaks, Cubans, Texas Toast sandwiches, the Glizzy Deal, salads and soups. Order online for pickup in Tampa.`,
    image: photos.menuSpread.src,
    jsonLd: () => restaurantJsonLd({ withMenu: true }),
  },
  privacy: {
    path: '/privacy-policy',
    title: `Privacy Policy | ${restaurant.fullName}`,
    description: `How ${restaurant.fullName} uses your information, including order text messages.`,
    image: photos.homeSubCombo.src,
  },
  terms: {
    path: '/terms-of-service',
    title: `Terms of Service | ${restaurant.fullName}`,
    description: `Ordering, payment and text message terms for ${restaurant.fullName}.`,
    image: photos.homeSubCombo.src,
  },
};

export const SITE_URL = SITE;
