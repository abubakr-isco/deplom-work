import { API_CONFIGURED } from '../config.js';
import { cartStore } from '../state/cart.js';
import { getCategories } from '../state/categories.js';
import { session } from '../state/session.js';
import { $, $$, cloneTemplate, urlWith } from './dom.js';

/** Какой пункт меню подсвечивать на странице (body[data-page]). */
const NAV_BY_PAGE = {
  home: 'home',
  catalog: 'catalog',
  product: 'catalog',
  cart: 'cart',
  login: 'account',
  register: 'account',
  profile: 'account',
};

function markActiveNav() {
  const active = NAV_BY_PAGE[document.body.dataset.page];
  for (const link of $$('[data-nav]')) {
    if (link.dataset.nav === active) link.setAttribute('aria-current', 'page');
  }
}

function updateAccount() {
  const authed = session.isAuthenticated;
  for (const link of $$('[data-account-link]')) link.href = authed ? '/profile.html' : '/login.html';
  for (const element of $$('[data-guest-only]')) element.hidden = authed;
}

function updateCartCount() {
  const count = cartStore.count;
  for (const element of $$('[data-cart-count]')) element.textContent = String(count);
  $('[data-cart-link]')?.setAttribute('aria-label', `Bag, items: ${count}`);
}

function setupMenu() {
  const toggle = $('[data-menu-toggle]');
  const menu = $('#mobile-menu');
  if (!toggle || !menu) return;

  const setOpen = (open) => {
    menu.hidden = !open;
    toggle.setAttribute('aria-expanded', String(open));
    toggle.setAttribute('aria-label', open ? 'Закрыть меню' : 'Открыть меню');
  };
  toggle.addEventListener('click', () => setOpen(menu.hidden));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !menu.hidden) {
      setOpen(false);
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 768px)').addEventListener('change', (event) => {
    if (event.matches) setOpen(false);
  });
}

function fillCategoryLinks() {
  const footerList = $('[data-footer-categories]');
  const menuList = $('[data-menu-categories]');
  getCategories()
    .then((categories) => {
      if (footerList) {
        const items = categories.slice(0, 3).map((category) => {
          const item = cloneTemplate('tpl-footer-link');
          const link = item.querySelector('a');
          link.href = urlWith('/catalog.html', { category: category.id });
          link.textContent = category.title;
          return item;
        });
        footerList.prepend(...items);
      }
      if (menuList) {
        menuList.replaceChildren(
          ...categories.map((category) => {
            const link = cloneTemplate('tpl-menu-link');
            link.href = urlWith('/catalog.html', { category: category.id });
            link.textContent = category.title;
            return link;
          }),
        );
      }
    })
    .catch(() => {
      // Без категорий в подвале остаётся ссылка «Все товары»; ошибку покажет сама страница.
    });
}

/** Общее поведение шапки и подвала на всех страницах. */
export function initLayout() {
  if (!API_CONFIGURED) $('[data-config-banner]')?.removeAttribute('hidden');
  const year = $('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());

  markActiveNav();
  setupMenu();
  updateAccount();
  updateCartCount();
  session.subscribe(updateAccount);
  cartStore.subscribe(updateCartCount);
  fillCategoryLinks();
}
