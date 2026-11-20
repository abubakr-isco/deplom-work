import { idOf, toNumber } from '../api/normalize.js';
import { cloneTemplate, formatPrice, productUrl, setImage } from './dom.js';
import { productImage } from './images.js';

/** Старая цена, если сервер её прислал и она больше текущей (иначе 0). */
function oldPriceOf(product) {
  const price = toNumber(product?.price, Number.NaN);
  const old = toNumber(product?.oldPrice ?? product?.compareAtPrice, Number.NaN);
  return Number.isFinite(price) && Number.isFinite(old) && old > price ? old : 0;
}

/** Карточка товара из шаблона #tpl-product-card. */
export function createProductCard(product, { badge = '' } = {}) {
  const card = cloneTemplate('tpl-product-card');
  const title = product?.title ?? 'Товар';

  card.querySelector('.product-card__link').href = productUrl(idOf(product));
  setImage(card.querySelector('img'), productImage(product), title);
  card.querySelector('.product-card__title').textContent = title;
  card.querySelector('[data-price]').textContent = formatPrice(product?.price);

  const oldPrice = oldPriceOf(product);
  const badgeEl = card.querySelector('.badge');
  if (oldPrice) {
    const oldEl = card.querySelector('.product-card__old-price');
    oldEl.textContent = formatPrice(oldPrice);
    oldEl.hidden = false;
    badgeEl.textContent = `-${Math.round((1 - toNumber(product.price) / oldPrice) * 100)}%`;
    badgeEl.classList.add('badge--sale');
    badgeEl.hidden = false;
  } else if (badge) {
    badgeEl.textContent = badge;
    badgeEl.hidden = false;
  }
  return card;
}
