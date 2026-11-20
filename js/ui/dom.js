/* Вспомогательные функции для работы с DOM, адресами и форматированием. */
import { API_ORIGIN } from '../config.js';

export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

/** Копия первого элемента из <template id="...">. */
export function cloneTemplate(id) {
  const template = document.getElementById(id);
  if (!(template instanceof HTMLTemplateElement)) throw new Error(`Шаблон #${id} не найден в HTML`);
  return template.content.firstElementChild.cloneNode(true);
}

/* ---------- Изображения ---------- */

/** Разрешаем только http(s)-адреса изображений из API. Относительные пути относятся к серверу API. */
export function safeImageUrl(url) {
  if (typeof url !== 'string' || !url.trim()) return '';
  try {
    const value = url.trim();
    const base = API_ORIGIN || window.location.origin;
    const parsed = new URL(value, `${base}/`);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : '';
  } catch {
    return '';
  }
}

/** Ставит картинку; без адреса или при ошибке загрузки контейнер .media показывает заглушку. */
export function setImage(img, url, alt = '') {
  const media = img.closest('.media');
  const src = safeImageUrl(url);
  img.alt = alt;
  if (!src) {
    img.removeAttribute('src');
    media?.classList.add('is-empty');
    return;
  }
  media?.classList.remove('is-empty');
  img.src = src;
}

/** Один обработчик на весь документ для «битых» картинок. */
export function installImageFallback() {
  document.addEventListener(
    'error',
    (event) => {
      if (event.target instanceof HTMLImageElement) event.target.closest('.media')?.classList.add('is-empty');
    },
    true,
  );
}

/* ---------- Форматирование ---------- */

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Цена в долларах США: $47.99 */
export function formatPrice(value) {
  const number = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(number) ? usd.format(number) : '—';
}

const dateFormat = new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
const dateTimeFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export function formatDate(value, withTime = false) {
  const date = value ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return '';
  return (withTime ? dateTimeFormat : dateFormat).format(date).replace(' г.', '');
}

/** plural(5, ['товар', 'товара', 'товаров']) → «товаров» */
export function plural(count, [one, few, many]) {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

/* ---------- Кнопки ---------- */

/** Блокирует кнопку на время запроса. Текст меняется, только если передан busyText. */
export function setBusy(button, busy, busyText) {
  if (!button) return;
  button.disabled = busy;
  button.classList.toggle('is-busy', busy);
  if (busy && busyText) {
    button.dataset.label = button.textContent;
    button.textContent = busyText;
  } else if (!busy && button.dataset.label !== undefined) {
    button.textContent = button.dataset.label;
    delete button.dataset.label;
  }
}

/* ---------- Адреса страниц ---------- */

/** urlWith('/catalog.html', { page: 2 }) → '/catalog.html?page=2' (пустые значения пропускаются). */
export function urlWith(path, params = {}) {
  const url = new URL(path, window.location.origin);
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.pathname + url.search;
}

export function currentUrl() {
  return window.location.pathname + window.location.search;
}

export function productUrl(id) {
  return urlWith('/product.html', { id });
}

export function loginUrl(redirect = currentUrl(), reason) {
  return urlWith('/login.html', { redirect, reason });
}

/** Адрес возврата после входа: только страницы этого сайта. */
export function safeRedirect(value, fallback = '/profile.html') {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  if (/^\/(login|register)\.html/.test(value)) return fallback;
  return value;
}
