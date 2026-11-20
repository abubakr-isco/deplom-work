import '../app.js';
import { normalizeProductPage } from '../api/normalize.js';
import { api } from '../api/shop.js';
import { CATALOG_PAGE_SIZE, LIMITS } from '../config.js';
import { getCategories } from '../state/categories.js';
import { $, $$, cloneTemplate, formatPrice, plural, urlWith } from '../ui/dom.js';
import { createProductCard } from '../ui/productCard.js';
import { loadList } from '../ui/states.js';

const DEFAULT_SLIDER_MAX = 1000;
const pageSize = window.matchMedia('(max-width: 767px)').matches ? 8 : CATALOG_PAGE_SIZE;

/* ---------- Фильтры из адреса страницы ---------- */

function parsePrice(value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  const number = Number(String(value).replace(',', '.'));
  return Number.isFinite(number) ? number : Number.NaN;
}

function readFilters() {
  const query = new URLSearchParams(window.location.search);
  const page = Number.parseInt(query.get('page') ?? '1', 10);
  const min = parsePrice(query.get('minPrice'));
  const max = parsePrice(query.get('maxPrice'));
  return {
    category: query.get('category') ?? '',
    minPrice: Number.isFinite(min) && min > 0 ? min : null,
    maxPrice: Number.isFinite(max) && max >= 0 ? max : null,
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

const filters = readFilters();

function catalogUrl(overrides = {}) {
  const next = { ...filters, ...overrides };
  return urlWith('/catalog.html', {
    category: next.category,
    minPrice: next.minPrice ?? '',
    maxPrice: next.maxPrice ?? '',
    page: next.page > 1 ? next.page : '',
  });
}

/* ---------- Категории ---------- */

const title = $('#catalog-title');
const categoriesList = $('[data-filter-categories]');

function createCategoryItem(id, name, count) {
  const item = cloneTemplate('tpl-filter-category');
  const link = item.querySelector('a');
  link.href = catalogUrl({ category: id, page: 1 });
  item.querySelector('[data-name]').textContent = name;
  item.querySelector('[data-count]').textContent = count === null ? '' : String(count);
  if (filters.category === id) link.setAttribute('aria-current', 'true');
  return item;
}

getCategories()
  .then((categories) => {
    categoriesList.replaceChildren(
      ...(filters.category ? [createCategoryItem('', 'All categories', null)] : []),
      ...categories.map((category) => createCategoryItem(category.id, category.title, category.productsCount)),
    );
    if (filters.category) {
      const current = categories.find((category) => category.id === filters.category);
      title.textContent = current?.title ?? 'Категория';
      document.title = `${title.textContent} — Sandbox Shop`;
    }
  })
  .catch(() => {
    categoriesList.querySelector('.filters__loading').textContent = 'Не удалось загрузить категории.';
  });

/* ---------- Цена ---------- */

function roundUpScale(value) {
  const step = value > 10000 ? 10000 : 1000;
  return Math.min(LIMITS.maxPrice, Math.ceil(value / step) * step);
}

function setupPriceFilter() {
  let sliderMax = roundUpScale(Math.max(DEFAULT_SLIDER_MAX, filters.minPrice ?? 0, filters.maxPrice ?? 0));
  const range = $('[data-price-range]');
  const rangeMin = $('[data-range="min"]');
  const rangeMax = $('[data-range="max"]');
  const inputMin = $('[data-price="min"]');
  const inputMax = $('[data-price="max"]');
  const error = $('[data-price-error]');

  const paint = () => {
    range.style.setProperty('--from', `${(Number(rangeMin.value) / sliderMax) * 100}%`);
    range.style.setProperty('--to', `${(Number(rangeMax.value) / sliderMax) * 100}%`);
  };
  const setScale = (value) => {
    if (value > sliderMax) sliderMax = roundUpScale(value);
    rangeMin.max = String(sliderMax);
    rangeMax.max = String(sliderMax);
  };

  // Начальные значения из адреса.
  setScale(sliderMax);
  inputMin.value = filters.minPrice ?? '';
  inputMax.value = filters.maxPrice ?? '';
  rangeMin.value = String(filters.minPrice ?? 0);
  rangeMax.value = String(filters.maxPrice ?? sliderMax);
  paint();

  rangeMin.addEventListener('input', () => {
    if (Number(rangeMin.value) > Number(rangeMax.value)) rangeMin.value = rangeMax.value;
    inputMin.value = Number(rangeMin.value) > 0 ? rangeMin.value : '';
    paint();
  });
  rangeMax.addEventListener('input', () => {
    if (Number(rangeMax.value) < Number(rangeMin.value)) rangeMax.value = rangeMin.value;
    inputMax.value = Number(rangeMax.value) >= sliderMax ? '' : rangeMax.value;
    paint();
  });
  inputMin.addEventListener('input', () => {
    const value = parsePrice(inputMin.value);
    if (Number.isFinite(value)) {
      setScale(value);
      rangeMin.value = String(Math.max(0, value));
    } else if (value === null) rangeMin.value = '0';
    paint();
  });
  inputMax.addEventListener('input', () => {
    const value = parsePrice(inputMax.value);
    if (Number.isFinite(value)) {
      setScale(value);
      rangeMax.value = String(value);
    } else if (value === null) rangeMax.value = String(sliderMax);
    paint();
  });

  $('[data-price-toggle]').addEventListener('click', (event) => {
    const button = event.currentTarget;
    const expanded = button.getAttribute('aria-expanded') === 'true';
    button.setAttribute('aria-expanded', String(!expanded));
    $('#price-body').hidden = expanded;
  });

  const apply = () => {
    const min = parsePrice(inputMin.value);
    const max = parsePrice(inputMax.value);
    let message = '';
    if (Number.isNaN(min) || Number.isNaN(max)) message = 'Введите цену числом.';
    else if ((min ?? 0) < 0 || (max ?? 0) < 0) message = 'Цена не может быть отрицательной.';
    else if ((min ?? 0) > LIMITS.maxPrice || (max ?? 0) > LIMITS.maxPrice)
      message = `Максимальная цена в магазине — ${formatPrice(LIMITS.maxPrice)}.`;
    else if (min !== null && max !== null && min > max) message = 'Минимальная цена больше максимальной.';

    error.textContent = message;
    error.hidden = !message;
    if (!message) window.location.assign(catalogUrl({ minPrice: min || null, maxPrice: max, page: 1 }));
  };

  $('[data-apply]').addEventListener('click', apply);
  for (const input of [inputMin, inputMax]) {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') apply();
    });
  }
}

/* ---------- Нижняя панель фильтров на телефоне ---------- */

function setupMobileSheet() {
  const panel = $('#catalog-filters');
  const backdrop = $('.filters-backdrop');
  const toggle = $('[data-filters-open]');
  const setOpen = (open) => {
    panel.classList.toggle('is-open', open);
    backdrop.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    document.documentElement.classList.toggle('has-sheet', open);
    if (open) panel.querySelector('.filters__close').focus();
  };
  toggle.addEventListener('click', () => setOpen(true));
  for (const element of $$('[data-filters-close]')) element.addEventListener('click', () => setOpen(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && panel.classList.contains('is-open')) {
      setOpen(false);
      toggle.focus();
    }
  });
}

/* ---------- Пагинация ---------- */

function setArrow(link, page) {
  if (page) {
    link.href = catalogUrl({ page });
    link.classList.remove('is-disabled');
    link.removeAttribute('aria-disabled');
  } else {
    link.removeAttribute('href');
    link.classList.add('is-disabled');
    link.setAttribute('aria-disabled', 'true');
  }
}

function renderPagination(page, pages) {
  const nav = $('[data-pagination]');
  nav.hidden = pages <= 1;
  if (pages <= 1) return;

  const items = [];
  const add = (n) => {
    if (n === page) {
      const item = cloneTemplate('tpl-page-current');
      item.querySelector('span').textContent = String(n);
      items.push(item);
    } else {
      const item = cloneTemplate('tpl-page-link');
      const link = item.querySelector('a');
      link.href = catalogUrl({ page: n });
      link.textContent = String(n);
      link.setAttribute('aria-label', `Страница ${n}`);
      items.push(item);
    }
  };
  const start = Math.max(2, page - 1);
  const end = Math.min(pages - 1, page + 1);
  add(1);
  if (start > 2) items.push(cloneTemplate('tpl-page-gap'));
  for (let n = start; n <= end; n += 1) add(n);
  if (end < pages - 1) items.push(cloneTemplate('tpl-page-gap'));
  add(pages);

  $('[data-pages]').replaceChildren(...items);
  setArrow($('[data-prev]'), page > 1 ? page - 1 : null);
  setArrow($('[data-next]'), page < pages ? page + 1 : null);
}

/* ---------- Товары ---------- */

const meta = $('[data-meta]');
const priceText = [
  filters.minPrice !== null ? `от ${formatPrice(filters.minPrice)}` : '',
  filters.maxPrice !== null ? `до ${formatPrice(filters.maxPrice)}` : '',
]
  .filter(Boolean)
  .join(' ');

setupPriceFilter();
setupMobileSheet();
$('.filters__reset').hidden = !(filters.category || filters.minPrice !== null || filters.maxPrice !== null);

loadList({
  list: $('[data-list]'),
  status: $('[data-status]'),
  skeletons: pageSize,
  load: () =>
    api.products({
      category: filters.category,
      minPrice: filters.minPrice ?? '',
      maxPrice: filters.maxPrice ?? '',
      page: filters.page,
      limit: pageSize,
    }),
  render: (data) => {
    const { products, total, page, pages } = normalizeProductPage(data);
    meta.textContent = `${total} ${plural(total, ['товар', 'товара', 'товаров'])}${priceText ? ` · цена ${priceText}` : ''}`;
    renderPagination(page, pages);
    return products.map((product) => createProductCard(product));
  },
  empty: (data) => {
    const { pages } = normalizeProductPage(data);
    if (pages > 0 && filters.page > pages) {
      return {
        text: `Страницы ${filters.page} нет — всего страниц: ${pages}.`,
        action: { href: catalogUrl({ page: 1 }), text: 'На первую страницу' },
      };
    }
    return {
      text: 'По выбранным фильтрам ничего не найдено.',
      action: { href: '/catalog.html', text: 'Сбросить фильтры' },
    };
  },
});
