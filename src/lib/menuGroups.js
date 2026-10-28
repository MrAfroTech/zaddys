/** Groups API menu items by category, keeping the menu's display order. */
export function groupByCategory(items) {
  const groups = [];
  for (const item of items) {
    const name = item.category || 'Menu';
    let g = groups.find((x) => x.name === name);
    if (!g) groups.push((g = { name, items: [] }));
    g.items.push(item);
  }
  return groups;
}
