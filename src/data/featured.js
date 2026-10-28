/**
 * Featured items on the homepage. Prices come from src/data/menu.js.
 * `image` is for a photo of that specific item — leave null unless the photo
 * shows that item.
 */
import { menuPrice, menuSections } from './menu';

function find(slug) {
  for (const s of menuSections) {
    const item = s.items.find((i) => i.slug === slug);
    if (item) return item;
  }
  throw new Error(`featured item not on menu: ${slug}`);
}

const special = find('cuban-special-4in');
const caesar = find('chicken-caesar-sandwich');
const philly = find('steak-cheese-philly');

export const featuredItems = [
  { name: special.name, price: menuPrice(special.prices[0]), availability: special.availability, image: null },
  { name: caesar.name, price: menuPrice(caesar.prices[0]), availability: caesar.availability, image: null },
  { name: philly.name, price: `From ${menuPrice(philly.prices[0])}`, image: null },
  { name: 'Glizzy Deal', price: `From ${menuPrice(find('glizzy-1-dog-can').prices[0])}`, image: null },
];
