/**
 * Zaddys photography (uploaded to /public/images/). These are small files
 * (about 200–370px wide), so the layout shows them near their real size
 * rather than stretching them. Alt text describes only what's visible —
 * sandwiches aren't named because the photos don't say which item they are.
 * TODO(zaddys): larger originals (1500px+ wide) would let photos go bigger.
 */
export const photos = {
  sandwichSpread: { src: '/images/IMG_1599.JPG', alt: 'Two takeout boxes of Zaddys subs cut in half, stacked in foil' },
  sandwichInHand: { src: '/images/IMG_1605.JPG', alt: 'A gloved hand holding a toasted Zaddys sub cut in half' },
  wrappedSandwich: { src: '/images/IMG_1596.JPG', alt: 'A Zaddys sandwich half in foil, stacked on another' },
  interior: { src: '/images/IMG_1600.JPG', alt: 'Inside Zaddys: the deli counter, tables and the neon logo on a green wall' },
  neonWall: { src: '/images/IMG_1597.JPG', alt: 'The neon Zaddys logo on a living green wall' },
  toppings: { src: '/images/IMG_1601.JPG', alt: 'The Zaddys prep line with fresh toppings and sauces' },
  menuWall: { src: '/images/IMG_1603.JPG', alt: 'Menu boards on the green wall above the Zaddys counter' },
  crowd: { src: '/images/IMG_1602.JPG', alt: 'Customers lined up at the Zaddys counter' },
};

/** Which photo each section uses. */
export const sectionPhotos = {
  featured: photos.wrappedSandwich,
  deals: photos.crowd,
  gallery: [photos.interior, photos.neonWall, photos.toppings, photos.menuWall],
};
