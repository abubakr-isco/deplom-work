import { request } from './client.js';

const enc = encodeURIComponent;

/** Все маршруты Sandbox Shop API (префикс /sandbox-shop добавляет client.js). */
export const api = {
  // Auth
  register: (payload) => request('/register', { method: 'POST', body: payload }),
  login: (payload) => request('/login', { method: 'POST', body: payload }),
  logout: () => request('/logout', { method: 'POST', auth: true }),
  me: (options) => request('/me', { auth: true, ...options }),

  // Каталог (без токена)
  products: (query, options) => request('/products', { query, ...options }),
  newest: (limit, options) => request('/products/newest', { query: { limit }, ...options }),
  bestsellers: (limit, options) => request('/products/bestsellers', { query: { limit }, ...options }),
  product: (id, options) => request(`/products/${enc(id)}`, options),
  categories: (options) => request('/categories', options),
  categoryProducts: (id, options) => request(`/categories/${enc(id)}/products`, options),

  // Корзина
  cart: (options) => request('/cart', { auth: true, ...options }),
  addToCart: (productId, qty) => request('/cart', { method: 'POST', auth: true, body: { productId, qty } }),
  updateCartItem: (productId, qty, options) =>
    request(`/cart/${enc(productId)}`, { method: 'PATCH', auth: true, body: { qty }, ...options }),
  removeCartItem: (productId) => request(`/cart/${enc(productId)}`, { method: 'DELETE', auth: true }),
  clearCart: () => request('/cart', { method: 'DELETE', auth: true }),

  // Заказы
  createOrder: () => request('/orders', { method: 'POST', auth: true }),
  orders: (options) => request('/orders', { auth: true, ...options }),

  // Комментарии
  addComment: (productId, text) =>
    request(`/products/${enc(productId)}/comments`, { method: 'POST', auth: true, body: { text } }),
  deleteComment: (productId, commentId) =>
    request(`/products/${enc(productId)}/comments/${enc(commentId)}`, { method: 'DELETE', auth: true }),
};
