/**
 * Zaddys photography. Shop photos (IMG_*.JPG) are small files (about
 * 200–370px wide), so the layout shows them near their real size. Food photos
 * are full-size (public/images/food, 1600px + 800px versions; originals in
 * photos-originals/). Alt text describes only what's visible.
 */
const food = (name, alt) => ({
  src: `/images/food/${name}.jpg`,
  srcSet: `/images/food/${name}-800.jpg 800w, /images/food/${name}.jpg 1600w`,
  width: 1600,
  height: 2133,
  alt,
});
export const photos = {
  homeSubCombo: food('home-sub-combo', 'A Zaddys sub loaded with ham, salami, cheese, pickles, tomato, peppers and onion, with a bag of chips and a can of soda'),
  menuSpread: food('menu-spread', 'A table spread of Zaddys food: subs, a hot dog with chili and cheese, a salad, a sandwich on dark bread and cups of soup'),
  phillySub: food('philly-sub', 'A Zaddys cheesesteak-style sub with chopped beef, melted cheese, green peppers, onions, tomato and lettuce'),
  hamSub: food('ham-sub', 'A long Zaddys sub with rolled ham, salami, cheese, pickles, tomato, peppers, onions and lettuce'),
  subDrizzle: food('sub-sauce-drizzle', 'A Zaddys sub with meat, cheese, tomato, green peppers, lettuce and a creamy sauce drizzle'),
  hotDog: food('hot-dog', 'A Zaddys hot dog topped with tomatoes, red onion, black olives, green peppers and onion'),
  salad: food('salad', 'A Zaddys salad with ham, turkey, boiled egg, olives, croutons, shredded cheese, tomato and peppers'),
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
  featured: photos.menuSpread,
  deals: photos.hotDog,
  gallery: [photos.interior, photos.neonWall, photos.toppings, photos.menuWall],
  // Food strip on the menu page.
  menu: [photos.phillySub, photos.hamSub, photos.subDrizzle, photos.salad],
};
