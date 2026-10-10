/**
 * Zaddys menu — only items and prices printed on the "Now Open" flyer.
 * Nothing else is listed until Zaddys supplies the full menu.
 * TODO(zaddys): add the full menu (and descriptions) when provided.
 */
export const menuSections = [
  {
    id: 'specials',
    title: 'Specials',
    items: [
      { name: '4 Inch Cuban Special', price: '$5.75', availability: 'Limited time' },
    ],
  },
  {
    id: 'glizzy-deal',
    title: 'Glizzy Deal',
    items: [
      { name: '1 Dog & a Drink', price: '$3.99' },
      { name: '2 Dogs & a Drink', price: '$5.99' },
    ],
  },
  {
    id: 'sandwiches',
    title: 'Sandwiches',
    items: [{ name: 'Zaddys Chicken Caesar Sandwich' }],
  },
];
