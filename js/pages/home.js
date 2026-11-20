import '../app.js';
import { listFrom } from '../api/normalize.js';
import { api } from '../api/shop.js';
import { HOME_BESTSELLERS_LIMIT, HOME_NEWEST_LIMIT } from '../config.js';
import { getCategories } from '../state/categories.js';
import { $, cloneTemplate, setImage, urlWith } from '../ui/dom.js';
import { categoryImage } from '../ui/images.js';
import { createProductCard } from '../ui/productCard.js';
import { loadList } from '../ui/states.js';

function createCategoryCard(category) {
  const card = cloneTemplate('tpl-category-card');
  card.href = urlWith('/catalog.html', { category: category.id });
  setImage(card.querySelector('img'), categoryImage(category), category.title);
  card.querySelector('.category-card__label').textContent = category.title;
  return card;
}

const section = (name) => ({ list: $(`[data-${name}] [data-list]`), status: $(`[data-${name}] [data-status]`) });

loadList({
  ...section('bestsellers'),
  skeletons: HOME_BESTSELLERS_LIMIT,
  load: () => api.bestsellers(HOME_BESTSELLERS_LIMIT),
  render: (data) => listFrom(data, 'products').map((product) => createProductCard(product)),
  empty: () => ({ text: 'Бестселлеров пока нет.' }),
});

loadList({
  ...section('categories'),
  skeletons: 3,
  skeletonTemplate: 'tpl-skeleton-category',
  load: getCategories,
  render: (categories) => categories.map(createCategoryCard),
  empty: () => ({ text: 'Категорий пока нет.' }),
});

loadList({
  ...section('newest'),
  skeletons: HOME_NEWEST_LIMIT,
  load: () => api.newest(HOME_NEWEST_LIMIT),
  render: (data) => listFrom(data, 'products').map((product) => createProductCard(product, { badge: product?.isNew ? 'Новинка' : '' })),
  empty: () => ({ text: 'Новинок пока нет.' }),
});
