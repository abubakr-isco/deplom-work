import '../app.js';
import { errorMessage } from '../api/client.js';
import { LIMITS } from '../config.js';
import { cartStore } from '../state/cart.js';
import { session } from '../state/session.js';
import { $, cloneTemplate, formatPrice, productUrl, setBusy, setImage } from '../ui/dom.js';
import { confirmDialog, openDialog } from '../ui/dialog.js';
import { productImage } from '../ui/images.js';
import { setState } from '../ui/states.js';
import { showToast } from '../ui/toast.js';

const QTY_DEBOUNCE_MS = 450;

const itemsList = $('[data-items]');
const statusBox = $('[data-cart-status]');
const guestBlock = $('[data-cart-guest]');
const emptyBlock = $('[data-cart-empty]');
const limitsText = $('[data-limits]');
const totalEl = $('[data-total]');
const emptySummary = $('[data-empty-summary]');
const noteEl = $('[data-summary-note]');
const checkoutButton = $('[data-checkout]');
const clearButton = $('[data-clear]');

/** Количество, выбранное пользователем, но ещё не подтверждённое сервером. */
const pending = new Map(); // productId -> { qty, timer, inFlight }
let busy = false; // идёт оформление заказа или очистка

/* ---------- Позиция корзины из шаблона #tpl-cart-item ---------- */

function createCartItem(item) {
  const row = cloneTemplate('tpl-cart-item');
  const qty = pending.get(item.productId)?.qty ?? item.qty;
  const href = productUrl(item.productId);
  row.dataset.id = item.productId;

  const media = row.querySelector('.cart-item__media');
  media.href = href;
  setImage(media.querySelector('img'), productImage(item), item.title);

  const titleLink = row.querySelector('.cart-item__title');
  titleLink.href = href;
  titleLink.textContent = item.title;
  row.querySelector('.cart-item__price').textContent = formatPrice(item.price);

  const sum = row.querySelector('.cart-item__sum');
  if (Number.isFinite(item.sum) && item.qty > 1) {
    sum.textContent = `Сумма: ${formatPrice(item.sum)}`;
    sum.hidden = false;
  }

  row.querySelector('[data-remove]').setAttribute('aria-label', `Удалить «${item.title}» из корзины`);
  row.querySelector('.stepper').setAttribute('aria-label', `Количество «${item.title}»`);
  row.querySelector('.stepper__value').textContent = String(qty);
  row.querySelector('[data-step="-1"]').disabled = qty <= 1;
  row.querySelector('[data-step="1"]').disabled = qty >= LIMITS.qtyPerPosition;
  return row;
}

/* ---------- Отрисовка по состоянию корзины ---------- */

function render() {
  const { cart, status, error } = cartStore.state;
  const authed = session.isAuthenticated;
  const ready = authed && status === 'ready';
  const hasItems = ready && cart.items.length > 0;

  // Запоминаем, на какой кнопке был фокус, чтобы вернуть его после перерисовки.
  const active = document.activeElement;
  const focusRow = active?.closest?.('.cart-item')?.dataset.id;
  const focusKey = active?.dataset?.step ?? (active?.hasAttribute?.('data-remove') ? 'remove' : null);

  guestBlock.hidden = authed;
  emptyBlock.hidden = !(ready && cart.items.length === 0);

  if (authed && (status === 'loading' || status === 'idle')) setState(statusBox, 'loading', { text: 'Загружаем корзину…' });
  else if (authed && status === 'error')
    setState(statusBox, 'error', {
      text: errorMessage(error, 'Не удалось загрузить корзину.'),
      onRetry: () => cartStore.refresh().catch(() => {}),
    });
  else setState(statusBox, null);

  itemsList.replaceChildren(...(hasItems ? cart.items.map(createCartItem) : []));
  limitsText.hidden = !hasItems;
  limitsText.textContent = `Позиций: ${cart.items.length} из ${LIMITS.cartPositions}. Не больше ${LIMITS.qtyPerPosition} шт. каждого товара.`;

  totalEl.textContent = formatPrice(ready ? cart.total : 0);
  emptySummary.hidden = hasItems;
  clearButton.hidden = !hasItems;
  clearButton.disabled = busy;
  checkoutButton.disabled = !hasItems || busy || pending.size > 0;
  noteEl.hidden = pending.size === 0;

  if (focusRow && focusKey) {
    const row = [...itemsList.children].find((element) => element.dataset.id === focusRow);
    const target = focusKey === 'remove' ? row?.querySelector('[data-remove]') : row?.querySelector(`[data-step="${focusKey}"]`);
    if (target && !target.disabled) target.focus();
  }
}

/* ---------- Изменение количества (с задержкой, чтобы не отправлять запрос на каждый клик) ---------- */

async function flush(productId) {
  const entry = pending.get(productId);
  if (!entry || entry.inFlight) return;
  entry.inFlight = true;
  const qty = entry.qty;
  try {
    await cartStore.setQty(productId, qty);
  } catch (error) {
    showToast(errorMessage(error), 'error');
    pending.delete(productId);
    render();
    return;
  }
  entry.inFlight = false;
  if (entry.qty !== qty) {
    flush(productId);
  } else {
    pending.delete(productId);
    render();
  }
}

function changeQty(productId, delta) {
  const item = cartStore.findItem(productId);
  if (!item) return;
  const entry = pending.get(productId) ?? { qty: item.qty, timer: 0, inFlight: false };
  const next = Math.min(LIMITS.qtyPerPosition, Math.max(1, entry.qty + delta));
  if (next === entry.qty) return;
  entry.qty = next;
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => flush(productId), QTY_DEBOUNCE_MS);
  pending.set(productId, entry);
  render();
}

itemsList.addEventListener('click', async (event) => {
  const row = event.target.closest('.cart-item');
  if (!row) return;
  const productId = row.dataset.id;

  const step = event.target.closest('[data-step]');
  if (step && !step.disabled) {
    changeQty(productId, Number(step.dataset.step));
    return;
  }

  const remove = event.target.closest('[data-remove]');
  if (!remove || remove.disabled) return;
  const entry = pending.get(productId);
  if (entry) clearTimeout(entry.timer);
  pending.delete(productId);
  setBusy(remove, true);
  try {
    await cartStore.remove(productId);
    showToast('Товар удалён из корзины', 'success');
  } catch (error) {
    showToast(errorMessage(error), 'error');
    setBusy(remove, false);
    if (error?.status === 404) cartStore.refresh().catch(() => {});
  }
});

/* ---------- Очистка ---------- */

clearButton.addEventListener('click', async () => {
  const ok = await confirmDialog({
    title: 'Очистить корзину?',
    text: 'Все товары будут удалены из корзины.',
    confirmLabel: 'Очистить',
    danger: true,
  });
  if (!ok) return;
  for (const entry of pending.values()) clearTimeout(entry.timer);
  pending.clear();
  busy = true;
  render();
  try {
    await cartStore.clear();
    showToast('Корзина очищена', 'success');
  } catch (error) {
    showToast(errorMessage(error), 'error');
  } finally {
    busy = false;
    render();
  }
});

/* ---------- Оформление заказа ---------- */

checkoutButton.addEventListener('click', async () => {
  const totalBefore = cartStore.state.cart.total;
  busy = true;
  setBusy(checkoutButton, true, 'Оформляем…');
  try {
    const data = await cartStore.checkout();
    const orderTotal = Number(data?.order?.total);
    $('[data-order-text]').textContent = `Заказ оформлен на сумму ${formatPrice(Number.isFinite(orderTotal) ? orderTotal : totalBefore)}`;
    openDialog($('#order-dialog'));
  } catch (error) {
    showToast(errorMessage(error), 'error');
    if (error?.status === 400 || error?.status === 409) cartStore.refresh().catch(() => {});
  } finally {
    busy = false;
    setBusy(checkoutButton, false);
    render();
  }
});

/* ---------- Незавершённые изменения отправляем при уходе со страницы ---------- */

window.addEventListener('pagehide', () => {
  for (const [productId, entry] of pending) {
    clearTimeout(entry.timer);
    if (!entry.inFlight) cartStore.setQty(productId, entry.qty, { keepalive: true }).catch(() => {});
  }
});

cartStore.subscribe(render);
session.subscribe(render);
render();
