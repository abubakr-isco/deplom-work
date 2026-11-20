import { requireAuth } from '../app.js';
import { errorMessage } from '../api/client.js';
import { listFrom, normalizeOrder } from '../api/normalize.js';
import { api } from '../api/shop.js';
import { DEMO_TOKEN } from '../api/demo.js';
import { cartStore } from '../state/cart.js';
import { fullName, session } from '../state/session.js';
import { $, cloneTemplate, formatDate, formatPrice, plural, productUrl, setBusy, setImage } from '../ui/dom.js';
import { loadList } from '../ui/states.js';
import { productImage } from '../ui/images.js';
import { flashToast } from '../ui/toast.js';

function formatPhone(phone) {
  const digits = String(phone ?? '').replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('998')) {
    return `+998 ${digits.slice(3, 5)} ${digits.slice(5, 8)}-${digits.slice(8, 10)}-${digits.slice(10)}`;
  }
  if (!phone) return '';
  return String(phone).startsWith('+') ? String(phone) : `+${digits}`;
}

function setText(selector, text) {
  const element = $(selector);
  element.textContent = text;
  element.hidden = !text;
}

function showUser(user) {
  $('[data-user-name]').textContent = fullName(user) || 'Покупатель';
  setText('[data-user-phone]', formatPhone(user?.phone));
  setText('[data-user-email]', user?.email ?? '');
  setText(
    '[data-user-since]',
    session.token === DEMO_TOKEN
      ? 'Демопрофиль. Корзина, заказы и отзывы сохранены только в этом браузере.'
      : user?.createdAt ? `Аккаунт создан ${formatDate(user.createdAt)}. Учебные данные удаляются через 45 дней.` : '',
  );
}

/* ---------- Заказ из шаблонов #tpl-order и #tpl-order-item ---------- */

function createOrderItem(item) {
  const element = cloneTemplate('tpl-order-item');
  const href = productUrl(item.productId);
  const media = element.querySelector('.order-item__media');
  media.href = href;
  setImage(media.querySelector('img'), productImage(item), item.title);
  const title = element.querySelector('.order-item__title');
  title.href = href;
  title.textContent = item.title;
  element.querySelector('.order-item__meta').textContent = `${item.qty} × ${formatPrice(item.price)}`;
  return element;
}

function createOrder(order) {
  const element = cloneTemplate('tpl-order');
  const count = order.items.reduce((sum, item) => sum + item.qty, 0);
  element.querySelector('.order__title').textContent = `Заказ от ${formatDate(order.createdAt, true) || '—'}`;
  element.querySelector('.order__meta').textContent =
    `№ ${order.id.slice(-8) || '—'} · ${count} ${plural(count, ['товар', 'товара', 'товаров'])}`;
  element.querySelector('[data-order-total]').textContent = formatPrice(order.total);
  element.querySelector('.order__items').replaceChildren(...order.items.map(createOrderItem));
  return element;
}

/* ---------- Запуск ---------- */

if (requireAuth()) {
  showUser(session.user);

  // Обновляем профиль с сервера (заодно проверяем, что токен ещё действует; 401 обрабатывает app.js).
  api
    .me()
    .then((data) => {
      if (!data?.user) return;
      session.updateUser(data.user);
      showUser(data.user);
    })
    .catch(() => {});

  loadList({
    list: $('[data-list]'),
    status: $('[data-status]'),
    loadingText: 'Загружаем заказы…',
    load: () => api.orders(),
    render: (data) => {
      const orders = listFrom(data, 'orders').map(normalizeOrder).map(createOrder);
      $('.profile__orders').hidden = orders.length === 0;
      return orders;
    },
    empty: () => ({ text: 'Вы ещё ничего не заказывали.', action: { href: '/catalog.html', text: 'Перейти в каталог' } }),
  });

  $('[data-logout]').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    setBusy(button, true, 'Выходим…');
    let serverError = null;
    try {
      // После logout сервер аннулирует все токены аккаунта.
      await api.logout();
    } catch (error) {
      if (error?.status !== 401) serverError = error;
    }
    session.clear();
    cartStore.reset();
    flashToast(
      serverError ? `Вы вышли на этом устройстве, но сервер не ответил: ${errorMessage(serverError)}` : 'Вы вышли из аккаунта',
      serverError ? 'error' : 'success',
    );
    window.location.replace('/');
  });
}
