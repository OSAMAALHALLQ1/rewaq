const MENU_DEPARTMENTS = new Set(['kitchen', 'bar', 'shisha']);
const NON_MENU_KEYS = ['seats', 'currentOrder', 'waiterCode', 'guests', 'role', 'username', 'salary', 'lastLogin'];

export const normalizeMenuItem = (item) => {
  if (!item || typeof item !== 'object') return null;
  if (NON_MENU_KEYS.some(key => Object.prototype.hasOwnProperty.call(item, key))) return null;

  const name = String(item.nameAr || item.name || '').trim();
  const price = Number(item.price);
  const category = String(item.category || '').trim();
  const department = String(item.department || '').trim();

  if (!name || !category || !MENU_DEPARTMENTS.has(department) || !Number.isFinite(price) || price < 0) {
    return null;
  }

  return {
    ...item,
    id: String(item.id || `item-${Date.now()}`),
    nameAr: String(item.nameAr || name).trim(),
    name: String(item.name || name).trim(),
    nameEn: item.nameEn ? String(item.nameEn).trim() : '',
    category,
    department,
    price,
    description: item.description ? String(item.description) : '',
    image: item.image || 'utensils',
    available: item.available !== false,
    prepTime: Number.isFinite(Number(item.prepTime)) ? Number(item.prepTime) : 15
  };
};

export const normalizeMenuItems = (items) => (
  Array.isArray(items) ? items.map(normalizeMenuItem).filter(Boolean) : []
);
