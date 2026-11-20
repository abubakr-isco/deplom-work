import { ApiError } from '../api/client.js';
import { normalizeCart } from '../api/normalize.js';
import { api } from '../api/shop.js';
import { LIMITS } from '../config.js';
import { session } from './session.js';

/**
 * Корзина пользователя. Источник правды — сервер: после каждого изменения
 * берём корзину из ответа (или запрашиваем GET /cart, если ответ её не содержит).
 * Итог (total) и суммы позиций всегда берутся из ответа сервера.
 */
const EMPTY_CART = Object.freeze({ items: [], total: 0 });

let state = { cart: EMPTY_CART, status: 'idle', error: null }; // idle | loading | ready | error
let loading = null;
const listeners = new Set();

function emit() {
  for (const listener of listeners) listener(state);
}

function setCart(cart) {
  state = { cart, status: 'ready', error: null };
  emit();
}

function refresh() {
  if (!session.isAuthenticated) {
    cartStore.reset();
    return Promise.resolve(state);
  }
  if (loading) return loading;
  if (state.status !== 'ready') {
    state = { ...state, status: 'loading', error: null };
    emit();
  }
  loading = api
    .cart()
    .then((data) => {
      setCart(normalizeCart(data) ?? EMPTY_CART);
      return state;
    })
    .catch((error) => {
      state = { ...state, status: 'error', error };
      emit();
      throw error;
    })
    .finally(() => {
      loading = null;
    });
  return loading;
}

async function applyResponse(data) {
  const cart = normalizeCart(data);
  if (cart) setCart(cart);
  else await refresh();
}

function findItem(productId) {
  return state.cart.items.find((item) => item.productId === String(productId)) ?? null;
}

export const cartStore = {
  get state() {
    return state;
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** Количество штук в корзине — для счётчика в шапке. */
  get count() {
    return state.cart.items.reduce((sum, item) => sum + item.qty, 0);
  },
  findItem,
  refresh,
  ensureLoaded() {
    if (state.status === 'ready') return Promise.resolve(state);
    return refresh();
  },
  reset() {
    state = { cart: EMPTY_CART, status: 'idle', error: null };
    emit();
  },

  /** Сколько ещё штук товара можно добавить (лимит 20 на позицию). */
  remainingFor(productId) {
    return Math.max(0, LIMITS.qtyPerPosition - (findItem(productId)?.qty ?? 0));
  },

  async add(productId, qty) {
    await this.ensureLoaded();
    const existing = findItem(productId);
    if (!existing && state.cart.items.length >= LIMITS.cartPositions) {
      throw new ApiError(409, `В корзине уже ${LIMITS.cartPositions} разных товаров — это максимум. Оформите заказ или удалите позицию.`);
    }
    if ((existing?.qty ?? 0) + qty > LIMITS.qtyPerPosition) {
      throw new ApiError(
        409,
        `Одного товара можно положить не больше ${LIMITS.qtyPerPosition} шт. Сейчас в корзине: ${existing?.qty ?? 0} шт.`,
      );
    }
    await applyResponse(await api.addToCart(String(productId), qty));
  },

  async setQty(productId, qty, options) {
    if (qty < 1 || qty > LIMITS.qtyPerPosition) {
      throw new ApiError(400, `Количество должно быть от 1 до ${LIMITS.qtyPerPosition}.`);
    }
    await applyResponse(await api.updateCartItem(String(productId), qty, options));
  },

  async remove(productId) {
    await applyResponse(await api.removeCartItem(String(productId)));
  },

  async clear() {
    await applyResponse(await api.clearCart());
  },

  /** POST /orders: заказ создаётся из текущей корзины на сервере. */
  async checkout() {
    const data = await api.createOrder();
    // Успешный заказ очищает корзину. Сразу обновляем интерфейс, даже если повторный GET не удастся.
    setCart(EMPTY_CART);
    await refresh().catch(() => {});
    return data;
  },
};

session.subscribe((reason) => {
  if (reason === 'login') refresh().catch(() => {});
  if (reason === 'logout' || reason === 'expired') cartStore.reset();
});
