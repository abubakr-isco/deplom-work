import { cloneTemplate } from './dom.js';

const FLASH_KEY = 'sandbox-shop.flash';

/**
 * Короткое уведомление (шаблон #tpl-toast).
 * @param {'info'|'success'|'error'} type
 */
export function showToast(message, type = 'info') {
  const region = document.querySelector('[data-toasts]');
  if (!region) return;

  const toast = cloneTemplate('tpl-toast');
  toast.classList.add(`toast--${type}`);
  toast.querySelector('.toast__text').textContent = message;

  const remove = () => toast.remove();
  toast.querySelector('.toast__close').addEventListener('click', remove);
  region.append(toast);
  setTimeout(remove, type === 'error' ? 7000 : 4000);

  while (region.children.length > 3) region.firstElementChild.remove();
}

/** Уведомление, которое покажется после перехода на другую страницу. */
export function flashToast(message, type = 'info') {
  try {
    sessionStorage.setItem(FLASH_KEY, JSON.stringify({ message, type }));
  } catch {
    // без sessionStorage уведомление просто не покажется
  }
}

export function showFlashToast() {
  try {
    const raw = sessionStorage.getItem(FLASH_KEY);
    if (!raw) return;
    sessionStorage.removeItem(FLASH_KEY);
    const { message, type } = JSON.parse(raw);
    if (message) showToast(message, type);
  } catch {
    // повреждённые данные игнорируем
  }
}
