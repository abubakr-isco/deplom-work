/**
 * Общий код всех страниц: шапка и подвал, счётчик корзины, обработка завершённой сессии.
 * Каждая страница подключает свой скрипт из js/pages/, который импортирует этот модуль.
 */
import { cartStore } from './state/cart.js';
import { session } from './state/session.js';
import { currentUrl, installImageFallback, loginUrl } from './ui/dom.js';
import { initLayout } from './ui/layout.js';
import { showFlashToast, showToast } from './ui/toast.js';

installImageFallback();
initLayout();
showFlashToast();

// Сервер ответил 401: токен истёк или был выполнен выход — сессия уже сброшена в api/client.js.
session.subscribe((reason) => {
  if (reason !== 'expired') return;
  if (document.body.hasAttribute('data-private')) {
    window.location.replace(loginUrl(currentUrl(), 'expired'));
    return;
  }
  showToast('Сессия завершена. Войдите снова.', 'error');
});

// Счётчик корзины в шапке — один запрос при открытии страницы.
if (session.isAuthenticated) cartStore.refresh().catch(() => {});

/** Для приватных страниц: без входа — переход на страницу входа. */
export function requireAuth() {
  if (session.isAuthenticated) return true;
  window.location.replace(loginUrl(currentUrl()));
  return false;
}
