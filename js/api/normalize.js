/**
 * Приведение ответов API к единому виду.
 * Формы ответов различаются: списки товаров — { total, page, pages, products } или { count, products },
 * категории — { count, categories }, корзина — { message, cart: { items, total } },
 * заказы — { count, orders }, товар — { product: { ..., comments } }.
 */

export function idOf(entity) {
  return String(entity?._id ?? entity?.id ?? '');
}

export function toNumber(value, fallback = 0) {
  const number = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(number) ? number : fallback;
}

export function listFrom(data, key) {
  if (Array.isArray(data?.[key])) return data[key];
  if (Array.isArray(data)) return data;
  return [];
}

/** Страница каталога: { total, page, pages, products }. */
export function normalizeProductPage(data) {
  const products = listFrom(data, 'products');
  return {
    products,
    total: toNumber(data?.total, products.length),
    page: Math.max(1, toNumber(data?.page, 1)),
    pages: Math.max(0, toNumber(data?.pages, products.length ? 1 : 0)),
  };
}

/** Корзина из ответа { cart: { items, total } }. Возвращает null, если корзины в ответе нет. */
export function normalizeCart(data) {
  const cart = data?.cart ?? data;
  if (!cart || !Array.isArray(cart.items)) return null;
  return {
    items: cart.items.map((item) => ({
      productId: String(item.productId ?? item.product?._id ?? item._id ?? ''),
      title: item.title ?? item.product?.title ?? 'Товар',
      price: toNumber(item.price ?? item.product?.price),
      image: item.image ?? item.product?.image ?? '',
      qty: Math.max(0, Math.trunc(toNumber(item.qty))),
      sum: toNumber(item.sum, Number.NaN),
    })),
    total: toNumber(cart.total),
  };
}

export function normalizeOrder(order) {
  return {
    id: idOf(order),
    items: listFrom(order, 'items').map((item) => ({
      productId: String(item.productId ?? ''),
      title: item.title ?? 'Товар',
      price: toNumber(item.price),
      image: item.image ?? '',
      qty: Math.max(0, Math.trunc(toNumber(item.qty))),
    })),
    total: toNumber(order?.total, Number.NaN),
    createdAt: order?.createdAt ?? null,
  };
}

export function normalizeComment(comment) {
  return {
    id: idOf(comment),
    author: comment?.author ?? 'Покупатель',
    text: comment?.text ?? '',
    at: comment?.at ?? comment?.createdAt ?? null,
    // В документации нет поля автора-пользователя, но если сервер его вернёт — используем.
    userId: String(comment?.userId ?? comment?.user?._id ?? comment?.user ?? comment?.authorId ?? ''),
  };
}
