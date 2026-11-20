import { idOf, listFrom } from '../api/normalize.js';
import { api } from '../api/shop.js';

/**
 * Категории нужны почти на каждой странице (подвал, меню, каталог, главная, товар).
 * Чтобы не запрашивать их при каждом переходе, храним их в sessionStorage 5 минут.
 */
const CACHE_KEY = 'sandbox-shop.categories';
const CACHE_TTL_MS = 5 * 60 * 1000;

let cache = readCache();
let pending = null;

function readCache() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(CACHE_KEY) || 'null');
    return saved && Date.now() - saved.time < CACHE_TTL_MS && Array.isArray(saved.items) ? saved.items : null;
  } catch {
    return null;
  }
}

function writeCache(items) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({ time: Date.now(), items }));
  } catch {
    // sessionStorage недоступен — просто не кэшируем.
  }
}

export function getCategories() {
  if (cache) return Promise.resolve(cache);
  if (!pending) {
    pending = api
      .categories()
      .then((data) => {
        cache = listFrom(data, 'categories').map((category) => ({
          id: idOf(category),
          title: category.title ?? 'Без названия',
          image: category.image ?? '',
          productsCount: Number(category.productsCount) || 0,
        }));
        writeCache(cache);
        return cache;
      })
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}
