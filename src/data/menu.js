/**
 * Zaddys menu — transcribed from the Zaddys menu board supplied by the client.
 * Prices are integer cents. Sized sections list one price per size, in the
 * same order as `sizes`. Item names and spellings are as printed.
 *
 * This file is the single source for the display menu (/menu, homepage) AND
 * for the online-ordering seed in db/schema.sql (generated from this file by
 * scripts/menu-seed.mjs). After changing it, regenerate the seed — or update
 * public.menu_items directly once ordering is live.
 */
export const menuSections = [
  {
    id: 'specials',
    title: 'Specials',
    items: [
      { slug: 'cuban-special-4in', name: '4 Inch Cuban Special', prices: [575], availability: 'Limited time' },
      {
        slug: 'chicken-caesar-sandwich',
        name: 'Zaddys Chicken Caesar Sandwich',
        prices: [1499],
        availability: 'New',
        description: 'On Texas Toast, grilled chicken breast, kale, Parmesan cheese, red onions & Caesar dressing',
      },
    ],
  },
  {
    id: 'philly',
    title: 'Philly Cheese Steak',
    sizes: ['6"', '8"', '10"'],
    items: [
      { slug: 'steak-cheese-philly', name: 'Steak & Cheese Philly', prices: [899, 1099, 1399] },
      { slug: 'chicken-philly', name: 'Chicken Philly', prices: [899, 1099, 1225] },
      { slug: 'salmon-philly', name: 'Salmon Philly', prices: [999, 1299, 1599] },
      { slug: 'chopped-beef-philly', name: 'Chopped Beef Philly', prices: [799, 999, 1299] },
    ],
  },
  {
    id: 'cubans',
    title: 'Cubans',
    sizes: ['6"', '8"', '12"'],
    items: [
      { slug: 'cuban-sandwich', name: 'Cuban Sandwich', prices: [899, 1025, 1299] },
      { slug: 'turkey-cuban', name: 'Turkey Cuban', prices: [899, 1025, 1299] },
      { slug: 'veggie-cuban', name: 'Veggie Cuban', prices: [699, 825, 1199] },
    ],
  },
  {
    id: 'sandwiches',
    title: 'Sandwiches',
    subtitle: 'Texas Toast style',
    items: [
      { slug: 'turkey-club', name: 'Turkey Club', prices: [1125] },
      { slug: 'turkey-royal', name: 'Turkey Royal', prices: [1225] },
      { slug: 'turkey-melt', name: 'Turkey Melt', prices: [1025] },
      { slug: 'ham-cheese', name: 'Ham & Cheese', prices: [999] },
      { slug: 'ham-cheese-melt', name: 'Ham & Cheese Melt', prices: [999] },
      { slug: 'tuna', name: 'Tuna', prices: [899] },
      { slug: 'tuna-melt', name: 'Tuna Melt', prices: [999] },
      { slug: 'grilled-cheese', name: 'Grilled Cheese', prices: [799] },
      { slug: 'italian', name: 'Italian', prices: [1099] },
      { slug: 'sandwich-add-extra-meat', name: 'Add Extra Meat', prices: [299], addOn: true },
      { slug: 'sandwich-add-bacon', name: 'Add Bacon', prices: [100], addOn: true },
    ],
  },
  {
    id: 'glizzy-deal',
    title: 'Glizzy Deal',
    subtitle: "Glizzy's / Hot Dogs",
    items: [
      { slug: 'glizzy-1-dog-can', name: '1 Dog & Can Drink', prices: [399] },
      { slug: 'glizzy-2-dogs-can', name: '2 Dogs & Can Drink', prices: [599] },
      { slug: 'hotdog-add-chilly', name: 'Add Chilly', prices: [100], addOn: true },
      { slug: 'hotdog-add-slaw', name: 'Add Slaw', prices: [100], addOn: true },
    ],
  },
  {
    id: 'salads',
    title: 'Salads',
    items: [
      { slug: 'build-a-salad', name: 'Build a Salad Your Own Way', prices: [1099] },
      { slug: 'caesar-salad', name: 'Caesar Salad', prices: [999] },
      { slug: 'grilled-chicken-caesar-salad', name: 'Grilled Chicken Caesar Salad', prices: [1299] },
    ],
  },
  {
    id: 'add-protein',
    title: 'Add Protein',
    items: [
      { slug: 'protein-tuna', name: 'Tuna', prices: [299], addOn: true },
      { slug: 'protein-boiled-egg', name: 'Boiled Egg', prices: [100], addOn: true },
      { slug: 'protein-grilled-salmon', name: 'Grilled Salmon', prices: [699], addOn: true },
      { slug: 'protein-grilled-chicken', name: 'Grilled Chicken', prices: [599], addOn: true },
      { slug: 'protein-turkey', name: 'Turkey', prices: [829], addOn: true },
      { slug: 'protein-ham', name: 'Ham', prices: [299], addOn: true },
      { slug: 'protein-bacon', name: 'Add Bacon', prices: [100], addOn: true },
    ],
  },
  {
    id: 'soup',
    title: 'Cup of Soup',
    availability: 'Wintertime',
    items: [
      { slug: 'soup-chicken-pot-pie', name: 'Chicken Pot Pie', prices: [550] },
      { slug: 'soup-cheddar-broccoli', name: 'Cheddar & Broccoli', prices: [525] },
      {
        slug: 'side-of-soup',
        name: 'Side of Soup',
        prices: [299],
        addOn: true,
        description: 'Add a side of soup to any sandwich or salad',
      },
    ],
  },
  {
    id: 'chips-drinks',
    title: 'Chips & Entrees',
    items: [
      { slug: 'can-and-chips', name: '12oz Can & Chips', prices: [325] },
      { slug: '20oz-drink-and-chips', name: '20oz Drink & Chips', prices: [375] },
      { slug: 'can-drink', name: 'Can Drink', prices: [199] },
      { slug: '20oz-drink', name: '20oz Drink', prices: [289] },
      { slug: 'natalies-juice', name: '12oz Natalies Juice', prices: [299] },
      { slug: 'bottle-water', name: 'Bottle Water', prices: [199] },
    ],
  },
];

/** "$8.99" from integer cents. */
export function menuPrice(cents) {
  return `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}
