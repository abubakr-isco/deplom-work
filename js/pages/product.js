import '../app.js';
import { errorMessage } from '../api/client.js';
import { idOf, normalizeComment } from '../api/normalize.js';
import { api } from '../api/shop.js';
import { LIMITS } from '../config.js';
import { cartStore } from '../state/cart.js';
import { getCategories } from '../state/categories.js';
import { fullName, session } from '../state/session.js';
import { $, cloneTemplate, formatDate, formatPrice, loginUrl, plural, setBusy, setImage, urlWith } from '../ui/dom.js';
import { confirmDialog, openDialog } from '../ui/dialog.js';
import { productImage } from '../ui/images.js';
import { setState } from '../ui/states.js';
import { showToast } from '../ui/toast.js';

const productId = new URLSearchParams(window.location.search).get('id') ?? '';

/* ---------- Какие отзывы «мои» ----------
 * В документации у комментария только { _id, author, text, at } — без id автора. Поэтому:
 *  - «точно мои» — id, которые вернул сервер при создании (храним по пользователю),
 *    или совпадение userId, если сервер его всё-таки вернёт;
 *  - «возможно мои» — совпадает имя автора (отзыв мог быть оставлен с другого устройства).
 * Лимит 3 считаем только по «точно моим», кнопку «Удалить» показываем и для «возможно моих».
 * Права проверяет сервер: после 403 отзыв помечается как чужой. */
const OWNERSHIP_KEY = 'sandbox-shop.comment-ownership';

function readOwnership() {
  try {
    return JSON.parse(localStorage.getItem(OWNERSHIP_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

function userOwnership(store = readOwnership()) {
  const record = store[session.user?._id] ?? {};
  return { mine: record.mine ?? [], notMine: record.notMine ?? [] };
}

/** kind: 'mine' — создан мной, 'notMine' — сервер ответил 403, 'forget' — удалён. */
function markComment(commentId, kind) {
  const userId = session.user?._id;
  if (!userId || !commentId) return;
  try {
    const store = readOwnership();
    const own = userOwnership(store);
    const mine = new Set(own.mine);
    const notMine = new Set(own.notMine);
    mine.delete(commentId);
    notMine.delete(commentId);
    if (kind === 'mine') mine.add(commentId);
    if (kind === 'notMine') notMine.add(commentId);
    store[userId] = { mine: [...mine].slice(-300), notMine: [...notMine].slice(-300) };
    localStorage.setItem(OWNERSHIP_KEY, JSON.stringify(store));
  } catch {
    // localStorage недоступен — не критично, права всё равно проверяет сервер.
  }
}

/** 'yes' | 'maybe' | 'no' */
function ownership(comment) {
  const user = session.user;
  if (!session.isAuthenticated || !user) return 'no';
  if (comment.userId) return comment.userId === String(user._id ?? '') ? 'yes' : 'no';
  const own = userOwnership();
  if (own.mine.includes(comment.id)) return 'yes';
  if (own.notMine.includes(comment.id)) return 'no';
  return comment.author === fullName(user) ? 'maybe' : 'no';
}

/* ---------- Состояния страницы ---------- */

const views = {
  loading: $('[data-view="loading"]'),
  error: $('[data-view="error"]'),
  content: $('[data-view="content"]'),
};

function showView(name) {
  for (const [key, element] of Object.entries(views)) element.hidden = key !== name;
}

/* ---------- Карточка отзыва из шаблона #tpl-review ---------- */

function createReviewCard(comment) {
  const owner = ownership(comment);
  const card = cloneTemplate('tpl-review');
  card.dataset.commentId = comment.id;
  card.classList.toggle('review-card--mine', owner === 'yes');
  card.querySelector('.review-card__author').textContent = comment.author;
  card.querySelector('.review-card__you').hidden = owner !== 'yes';
  card.querySelector('.review-card__text').textContent = `«${comment.text}»`;

  const time = card.querySelector('.review-card__date');
  const date = formatDate(comment.at);
  time.textContent = date ? `Опубликовано ${date}` : '';
  if (comment.at) time.dateTime = comment.at;

  const deleteButton = card.querySelector('[data-delete-comment]');
  deleteButton.hidden = owner === 'no';
  deleteButton.dataset.deleteComment = comment.id;
  return card;
}

/* ---------- Запуск ---------- */

async function loadProduct() {
  showView('loading');
  if (!productId) {
    showNotFound();
    return;
  }
  try {
    const data = await api.product(productId);
    const product = data?.product ?? data;
    if (!product || typeof product !== 'object') throw new Error('Пустой ответ сервера');
    showProduct(product);
  } catch (error) {
    if (error?.status === 404) showNotFound();
    else {
      setState(views.error, 'error', { text: errorMessage(error, 'Не удалось загрузить товар.'), onRetry: loadProduct });
      showView('error');
    }
  }
}

function showNotFound() {
  setState(views.error, 'empty', {
    text: 'Товар не найден — возможно, его удалили.',
    action: { href: '/catalog.html', text: 'В каталог' },
  });
  showView('error');
}

function showProduct(product) {
  const id = idOf(product) || productId;
  const title = product.title ?? 'Товар';
  document.title = `${title} — Sandbox Shop`;

  setImage($('[data-product-image]'), productImage(product), title);
  $('[data-product-title]').textContent = title;
  $('[data-product-price]').textContent = formatPrice(product.price);
  const description = $('[data-product-description]');
  description.textContent = product.description ?? '';
  description.hidden = !product.description;
  const orders = Number(product.ordersCount) || 0;
  $('[data-product-stats]').textContent = orders > 0 ? `Заказали ${orders} ${plural(orders, ['раз', 'раза', 'раз'])}` : '';

  if (product.categoryId) {
    getCategories()
      .then((categories) => {
        const category = categories.find((c) => c.id === String(product.categoryId));
        if (!category) return;
        const wrap = $('[data-product-category]');
        const link = wrap.querySelector('a');
        link.href = urlWith('/catalog.html', { category: category.id });
        link.textContent = category.title;
        wrap.hidden = false;
      })
      .catch(() => {});
  }

  showView('content');
  setupBuy(id, title);
  setupReviews(id, (Array.isArray(product.comments) ? product.comments : []).map(normalizeComment));
}

/* ---------- Покупка ---------- */

function setupBuy(id, title) {
  let qty = 1;
  const qtyValue = $('[data-qty-value]');
  const addButton = $('[data-add]');
  const note = $('[data-cart-note]');
  const minusButton = $('[data-qty="-1"]');
  const plusButton = $('[data-qty="1"]');

  const maxQty = () => (session.isAuthenticated ? cartStore.remainingFor(id) : LIMITS.qtyPerPosition);

  const sync = () => {
    const max = maxQty();
    qty = Math.min(Math.max(1, qty), Math.max(1, max));
    qtyValue.textContent = String(qty);
    minusButton.disabled = qty <= 1;
    plusButton.disabled = qty >= max;

    const authed = session.isAuthenticated;
    const inCart = authed ? (cartStore.findItem(id)?.qty ?? 0) : 0;
    const positionsFull = authed && !inCart && cartStore.state.cart.items.length >= LIMITS.cartPositions;
    addButton.disabled = addButton.classList.contains('is-busy') || (authed && (max === 0 || positionsFull));

    if (!authed) note.textContent = 'Войдите, чтобы добавить товар в корзину.';
    else if (max === 0) note.textContent = `В корзине уже ${LIMITS.qtyPerPosition} шт. — это максимум для одного товара.`;
    else if (positionsFull) note.textContent = `В корзине уже ${LIMITS.cartPositions} разных товаров — это максимум.`;
    else if (inCart) note.textContent = `В корзине: ${inCart} шт. Можно добавить ещё ${max}.`;
    else note.textContent = '';
  };

  minusButton.addEventListener('click', () => {
    qty -= 1;
    sync();
  });
  plusButton.addEventListener('click', () => {
    qty += 1;
    sync();
  });

  addButton.addEventListener('click', async () => {
    if (!session.isAuthenticated) {
      window.location.assign(loginUrl());
      return;
    }
    setBusy(addButton, true, 'Добавляем…');
    try {
      await cartStore.add(id, qty);
      showToast(`«${title}» — ${qty} шт. в корзине`, 'success');
      qty = 1;
    } catch (error) {
      showToast(errorMessage(error), 'error');
    } finally {
      setBusy(addButton, false);
      sync();
    }
  });

  cartStore.subscribe(sync);
  session.subscribe(sync);
  sync();
}

/* ---------- Отзывы ---------- */

function setupReviews(productIdValue, initialComments) {
  let comments = initialComments;
  const list = $('[data-reviews]');
  const emptyBlock = $('[data-reviews-empty]');
  const count = $('[data-review-count]');
  const hint = $('[data-review-hint]');
  const writeButton = $('[data-write]');

  const render = () => {
    const sorted = comments.toSorted((a, b) => new Date(b.at || 0) - new Date(a.at || 0));
    count.textContent = `(${comments.length})`;
    list.replaceChildren(...sorted.map(createReviewCard));
    emptyBlock.hidden = sorted.length > 0;

    const limitReached = comments.filter((c) => ownership(c) === 'yes').length >= LIMITS.commentsPerProduct;
    writeButton.disabled = session.isAuthenticated && limitReached;
    let text = '';
    if (!session.isAuthenticated) text = 'Чтобы оставить отзыв, войдите в аккаунт.';
    else if (limitReached)
      text = `Вы уже оставили ${LIMITS.commentsPerProduct} отзыва к этому товару — это максимум. Удалите один, чтобы написать новый.`;
    hint.textContent = text;
    hint.hidden = !text;
  };

  /* --- Окно «Оставить отзыв» (разметка — #comment-dialog в product.html) --- */
  const dialog = $('#comment-dialog');
  const form = dialog.querySelector('[data-step="form"]');
  const thanks = dialog.querySelector('[data-step="thanks"]');
  const textarea = form.querySelector('textarea');
  const counter = form.querySelector('#comment-counter');
  const error = form.querySelector('#comment-error');
  const submit = form.querySelector('[type="submit"]');

  const showError = (message) => {
    error.textContent = message;
    error.hidden = !message;
    textarea.setAttribute('aria-invalid', message ? 'true' : 'false');
  };
  const showStep = (step) => {
    form.hidden = step !== 'form';
    thanks.hidden = step !== 'thanks';
    dialog.classList.toggle('modal--form', step === 'form');
    dialog.classList.toggle('modal--message', step === 'thanks');
    dialog.setAttribute('aria-labelledby', step === 'form' ? 'comment-title' : 'comment-thanks-title');
  };

  writeButton.addEventListener('click', () => {
    if (!session.isAuthenticated) {
      window.location.assign(loginUrl());
      return;
    }
    form.reset();
    counter.textContent = `0 / ${LIMITS.commentMax}`;
    showError('');
    setBusy(submit, false);
    showStep('form');
    openDialog(dialog);
    textarea.focus();
  });

  textarea.addEventListener('input', () => {
    counter.textContent = `${textarea.value.length} / ${LIMITS.commentMax}`;
    if (!error.hidden) showError('');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const text = textarea.value.trim();
    if (text.length < LIMITS.commentMin) return showError(`Минимум ${LIMITS.commentMin} символа.`);
    if (text.length > LIMITS.commentMax) return showError(`Максимум ${LIMITS.commentMax} символов.`);

    setBusy(submit, true, 'Отправляем…');
    try {
      const data = await api.addComment(productIdValue, text);
      const created = data?.comment ? normalizeComment(data.comment) : null;
      if (created?.id) {
        markComment(created.id, 'mine');
        comments.push(created);
      } else {
        const fresh = await api.product(productIdValue);
        comments = (fresh?.product?.comments ?? []).map(normalizeComment);
      }
      render();
      showStep('thanks');
      thanks.querySelector('[data-dialog-close]').focus();
    } catch (err) {
      if (err?.status === 401) {
        dialog.close();
        window.location.assign(loginUrl());
        return;
      }
      showError(errorMessage(err));
    } finally {
      setBusy(submit, false);
    }
    return undefined;
  });

  /* --- Удаление своего отзыва --- */
  list.addEventListener('click', async (event) => {
    const button = event.target.closest('[data-delete-comment]');
    if (!button) return;
    const commentId = button.dataset.deleteComment;
    const ok = await confirmDialog({
      title: 'Удалить отзыв?',
      text: 'Отзыв будет удалён без возможности восстановления.',
      confirmLabel: 'Удалить',
      danger: true,
    });
    if (!ok) return;

    setBusy(button, true);
    try {
      await api.deleteComment(productIdValue, commentId);
      comments = comments.filter((c) => c.id !== commentId);
      markComment(commentId, 'forget');
      showToast('Отзыв удалён', 'success');
    } catch (err) {
      if (err?.status === 404) {
        comments = comments.filter((c) => c.id !== commentId);
        markComment(commentId, 'forget');
        showToast('Этот отзыв уже удалён.', 'info');
      } else {
        if (err?.status === 403) markComment(commentId, 'notMine');
        showToast(errorMessage(err), 'error');
        setBusy(button, false);
      }
    }
    render();
  });

  session.subscribe(render);
  render();
}

loadProduct();
