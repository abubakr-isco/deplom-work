/**
 * Настройки приложения.
 *
 * Адрес сервера API не хранится в коде: он задаётся в .env / .env.local
 * (VITE_API_ORIGIN или API_PROXY_TARGET, см. .env.example и vite.config.js).
 */
const rawOrigin = String(import.meta.env.VITE_API_ORIGIN ?? '').trim();

/** Все маршруты API начинаются с этого префикса. */
export const API_PREFIX = '/sandbox-shop';

/**
 * Адрес сервера без завершающего «/» и без /sandbox-shop (если его указали в .env — убираем,
 * чтобы не получилось /sandbox-shop/sandbox-shop). Пустая строка — тот же домен, что и сайт.
 */
export const API_ORIGIN = rawOrigin.replace(/\/+$/, '').replace(/\/sandbox-shop$/, '');

export const API_BASE = `${API_ORIGIN}${API_PREFIX}`;

/**
 * true, если адрес API задан явно (прямой адрес или прокси Vite)
 * или это production-сборка, размещённая рядом с API на одном домене.
 */
export const API_CONFIGURED = Boolean(API_ORIGIN) || __API_PROXY_CONFIGURED__ || import.meta.env.PROD;

/** Ограничения учебного API (из документации и sandbox-shop.json). */
export const LIMITS = Object.freeze({
  cartPositions: 20,
  qtyPerPosition: 20,
  commentMin: 2,
  commentMax: 300,
  commentsPerProduct: 3,
  maxPrice: 100000,
});

/** Количество товаров на странице каталога для компьютера (значение по умолчанию в API — 12). */
export const CATALOG_PAGE_SIZE = 12;

/** Сколько бестселлеров и новинок показывать на главной. */
export const HOME_BESTSELLERS_LIMIT = 4;
export const HOME_NEWEST_LIMIT = 12;

/** Учебные данные удаляются автоматически через это число дней. */
export const DATA_RETENTION_DAYS = 45;
