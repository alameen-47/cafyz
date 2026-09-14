/**
 * Photos for the built-in demo dishes (backend/src/services/demoData.ts), bundled in
 * web-v2/public/demo-menu so they load offline and inside the native shells.
 * Keyed by the exact demo dish name and only used for demo rows without an uploaded
 * photo — a restaurant's own dishes never get a stand-in picture.
 */
const DEMO_MENU_IMAGES: Record<string, string> = {
  'Garlic Bread': 'garlic-bread.jpg',
  'Crispy Chicken Wings': 'chicken-wings.jpg',
  'Caesar Salad': 'caesar-salad.jpg',
  'Tomato Basil Soup': 'tomato-basil-soup.jpg',
  'Classic Cheeseburger': 'cheeseburger.jpg',
  'Grilled Chicken & Zucchini': 'grilled-chicken.jpg',
  // Name used by demo data loaded before the rename; the photo still matches.
  'Grilled Chicken': 'grilled-chicken.jpg',
  'Margherita Pizza': 'margherita-pizza.jpg',
  'Penne Arrabbiata': 'penne-arrabbiata.jpg',
  'Grilled Salmon': 'grilled-salmon.jpg',
  'Veggie Buddha Bowl': 'buddha-bowl.jpg',
  'Slow-cooked Lamb Shank': 'lamb-shank.jpg',
  'Chocolate Lava Cake': 'chocolate-lava-cake.jpg',
  'New York Cheesecake': 'new-york-cheesecake.jpg',
  'Ice Cream Trio': 'ice-cream-trio.jpg',
  'House Red (Glass)': 'house-red-wine.jpg',
  'Lemon-Lime Slush': 'lemon-lime-slush.jpg',
  'Iced Latte': 'iced-latte.jpg',
  'Mango Smoothie': 'mango-smoothie.jpg',
  'Sparkling Water': 'sparkling-water.jpg',
};

export function demoMenuImage(item: { name: string; is_demo?: number | boolean | null }): string {
  if (!item.is_demo) return '';
  const file = DEMO_MENU_IMAGES[item.name];
  return file ? `/demo-menu/${file}` : '';
}
