/** Фотографии товаров — исходники из макета (Desktop.svg). */
const productPhotoPaths = [
  '/images/product-face-toner.jpg',
  '/images/product-body-wash.jpg',
  '/images/product-body-serum.jpg',
  '/images/product-face-mask.jpg',
];

const productPhotos = new Map([
  ['face toner', productPhotoPaths[0]],
  ['тоник для лица', productPhotoPaths[0]],
  ['body wash', productPhotoPaths[1]],
  ['гель для душа', productPhotoPaths[1]],
  ['body serum', productPhotoPaths[2]],
  ['сыворотка для тела', productPhotoPaths[2]],
  ['face mask', productPhotoPaths[3]],
  ['маска для лица', productPhotoPaths[3]],
]);

const categoryPhotos = new Map([
  ['creams', '/images/category-creams.jpg'],
  ['кремы', '/images/category-creams.jpg'],
  ['serums', '/images/category-serums.jpg'],
  ['сыворотки', '/images/category-serums.jpg'],
  ['lotion', '/images/category-lotion.jpg'],
  ['lotions', '/images/category-lotion.jpg'],
  ['лосьоны', '/images/category-lotion.jpg'],
]);

const localUrl = (path) => new URL(path, window.location.origin).href;
const keyOf = (title) => String(title ?? '').trim().toLowerCase();

export function productImage(product) {
  const named = productPhotos.get(keyOf(product?.title));
  if (named) return localUrl(named);
  // Остальные товары тоже получают одну из четырёх фотографий макета.
  // Стабильный ключ сохраняет одинаковое фото в каталоге, корзине и заказах.
  const key = String(product?._id ?? product?.id ?? product?.productId ?? product?.title ?? '');
  const hash = [...key].reduce((value, char) => (value * 31 + char.codePointAt(0)) >>> 0, 0);
  return localUrl(productPhotoPaths[hash % productPhotoPaths.length]);
}

export function categoryImage(category) {
  const local = categoryPhotos.get(keyOf(category?.title));
  return local ? localUrl(local) : category?.image;
}
