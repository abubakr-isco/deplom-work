/** Локальный учебный аккаунт и данные для проверки сайта без доступного API. */
import { LIMITS } from '../config.js';

export const DEMO_EMAIL = 'demo@sandbox-shop.test';
export const DEMO_PASSWORD = 'Demo2026!';
export const DEMO_TOKEN = 'sandbox-shop-local-demo';

const STORAGE_KEY = 'sandbox-shop.demo-data';
const USER = Object.freeze({
  _id: 'demo-user',
  name: 'Alex',
  surname: 'Adams',
  email: DEMO_EMAIL,
  phone: '+998901234567',
  createdAt: '2026-11-11T00:00:00.000Z',
});

const categories = [
  { _id: 'creams', title: 'Creams', image: '/images/category-creams.jpg' },
  { _id: 'serums', title: 'Serums', image: '/images/category-serums.jpg' },
  { _id: 'lotion', title: 'Lotion', image: '/images/category-lotion.jpg' },
];

const names = ['Face Toner', 'Body Wash', 'Body Serum', 'Face Mask'];
const photos = ['product-face-toner', 'product-body-wash', 'product-body-serum', 'product-face-mask'];
const prices = [47.99, 49.99, 49.99, 49.99];
const products = Array.from({ length: 12 }, (_, index) => {
  const type = index % 4;
  return {
    _id: `demo-product-${index + 1}`,
    title: names[type],
    price: prices[type],
    // Как в макете: скидка у первого товара и метка «Новинка» у третьего
    ...(index === 0 ? { oldPrice: 59.99 } : {}),
    ...(index === 2 ? { isNew: true } : {}),
    image: `/images/${photos[type]}.jpg`,
    categoryId: categories[index % 3]._id,
    description: 'Учебный товар для проверки работы магазина.',
    ordersCount: 0,
  };
});

function readData() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    if (value && Array.isArray(value.cart) && Array.isArray(value.orders) && value.comments) return value;
  } catch {
    // Повреждённые данные деморежима заменяем пустыми.
  }
  return { cart: [], orders: [], comments: {} };
}

function saveData(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function imageUrl(path) {
  return new URL(path, window.location.origin).href;
}

function productById(id) {
  return products.find((product) => product._id === id);
}

function failure(status, message) {
  return { status, data: { message } };
}

function cartResponse(data) {
  const items = data.cart.map(({ productId, qty }) => {
    const product = productById(productId);
    return {
      productId,
      title: product.title,
      price: product.price,
      image: imageUrl(product.image),
      qty,
      sum: Number((product.price * qty).toFixed(2)),
    };
  });
  return { cart: { items, total: Number(items.reduce((total, item) => total + item.sum, 0).toFixed(2)) } };
}

function productPage(query = {}) {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const limit = Math.max(1, Number.parseInt(query.limit, 10) || 12);
  const min = query.minPrice === '' || query.minPrice === undefined || query.minPrice === null ? 0 : Number(query.minPrice);
  const max = query.maxPrice === '' || query.maxPrice === undefined || query.maxPrice === null ? Infinity : Number(query.maxPrice);
  const filtered = products.filter((product) =>
    (!query.category || product.categoryId === query.category) && product.price >= min && product.price <= max,
  );
  return {
    total: filtered.length,
    page,
    pages: Math.ceil(filtered.length / limit),
    products: filtered.slice((page - 1) * limit, page * limit).map((product) => ({ ...product, image: imageUrl(product.image) })),
  };
}

function publicResponse(path, query) {
  if (path === '/categories') {
    return {
      categories: categories.map((category) => ({
        ...category,
        image: imageUrl(category.image),
        productsCount: products.filter((product) => product.categoryId === category._id).length,
      })),
    };
  }
  if (path === '/products') return productPage(query);
  if (path === '/products/newest')
    return { products: productPage({ limit: query?.limit }).products.toReversed() };
  if (path === '/products/bestsellers')
    return { products: productPage({ limit: query?.limit }).products };
  const categoryId = path.match(/^\/categories\/([^/]+)\/products$/)?.[1];
  if (categoryId) return productPage({ ...query, category: decodeURIComponent(categoryId) });
  const productId = path.match(/^\/products\/([^/]+)$/)?.[1];
  if (productId) {
    const product = productById(decodeURIComponent(productId));
    if (!product) return failure(404, 'Товар не найден.');
    return { product: { ...product, image: imageUrl(product.image), comments: readData().comments[product._id] ?? [] } };
  }
  return null;
}

function privateResponse(path, method, body) {
  const data = readData();
  if (path === '/me') return { user: USER };
  if (path === '/logout') return { message: 'Вы вышли.' };
  if (path === '/cart') {
    if (method === 'POST') {
      const product = productById(String(body?.productId));
      const qty = Number(body?.qty);
      if (!product || !Number.isInteger(qty) || qty < 1) return failure(400, 'Неверный товар или количество.');
      const item = data.cart.find((entry) => entry.productId === product._id);
      if (!item && data.cart.length >= LIMITS.cartPositions) return failure(409, 'Корзина заполнена.');
      if ((item?.qty ?? 0) + qty > LIMITS.qtyPerPosition) return failure(409, 'Превышено количество товара.');
      if (item) item.qty += qty;
      else data.cart.push({ productId: product._id, qty });
      saveData(data);
    } else if (method === 'DELETE') {
      data.cart = [];
      saveData(data);
    }
    return cartResponse(data);
  }
  const cartItemId = path.match(/^\/cart\/([^/]+)$/)?.[1];
  if (cartItemId) {
    const index = data.cart.findIndex((entry) => entry.productId === decodeURIComponent(cartItemId));
    if (index < 0) return failure(404, 'Товар не найден в корзине.');
    if (method === 'PATCH') {
      const qty = Number(body?.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > LIMITS.qtyPerPosition) return failure(400, 'Неверное количество.');
      data.cart[index].qty = qty;
    } else if (method === 'DELETE') data.cart.splice(index, 1);
    saveData(data);
    return cartResponse(data);
  }
  if (path === '/orders') {
    if (method === 'GET') return { count: data.orders.length, orders: data.orders.toReversed() };
    if (method === 'POST') {
      const cart = cartResponse(data).cart;
      if (!cart.items.length) return failure(400, 'Корзина пуста.');
      const order = {
        _id: `demo-order-${Date.now()}`,
        items: cart.items,
        total: cart.total,
        createdAt: new Date().toISOString(),
      };
      data.orders.push(order);
      data.cart = [];
      saveData(data);
      return { order };
    }
  }
  const comments = path.match(/^\/products\/([^/]+)\/comments(?:\/([^/]+))?$/);
  if (comments) {
    const productId = decodeURIComponent(comments[1]);
    if (!productById(productId)) return failure(404, 'Товар не найден.');
    const list = data.comments[productId] ?? [];
    if (method === 'POST') {
      const text = String(body?.text ?? '').trim();
      if (text.length < LIMITS.commentMin || text.length > LIMITS.commentMax)
        return failure(400, 'Длина отзыва должна быть от 2 до 300 символов.');
      if (list.length >= LIMITS.commentsPerProduct) return failure(409, 'Лимит отзывов достигнут.');
      const comment = {
        _id: `demo-comment-${Date.now()}`,
        author: `${USER.name} ${USER.surname}`,
        userId: USER._id,
        text,
        at: new Date().toISOString(),
      };
      list.push(comment);
      data.comments[productId] = list;
      saveData(data);
      return { comment };
    }
    if (method === 'DELETE') {
      const index = list.findIndex((comment) => comment._id === decodeURIComponent(comments[2] ?? ''));
      if (index < 0) return failure(404, 'Отзыв не найден.');
      list.splice(index, 1);
      data.comments[productId] = list;
      saveData(data);
      return { message: 'Отзыв удалён.' };
    }
  }
  return failure(404, 'Демо-маршрут не найден.');
}

/** Возвращает null, если запрос должен идти к настоящему API. */
export function demoResponse(path, { method = 'GET', body, query, token, fallback = false } = {}) {
  if (path === '/login' && method === 'POST' && body?.email?.trim().toLowerCase() === DEMO_EMAIL) {
    if (body.password !== DEMO_PASSWORD) return failure(401, 'Неверный пароль демопользователя.');
    return { token: DEMO_TOKEN, user: USER };
  }
  if (token === DEMO_TOKEN) {
    if (path === '/login' || path === '/register') return failure(409, 'Сначала выйдите из демоаккаунта.');
    return publicResponse(path, query) ?? privateResponse(path, method, body);
  }
  if (fallback && method === 'GET') return publicResponse(path, query);
  return null;
}
