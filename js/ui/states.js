import { cloneTemplate } from './dom.js';

/**
 * Показывает состояние в контейнере по шаблонам #tpl-state-loading / -error / -empty.
 * kind = null очищает контейнер.
 */
export function setState(container, kind, { text = '', action = null, onRetry = null } = {}) {
  if (!kind) {
    container.replaceChildren();
    return;
  }
  const node = cloneTemplate(`tpl-state-${kind}`);
  const label = node.querySelector('[data-text]');
  if (label && text) label.textContent = text;

  if (kind === 'empty' && action) {
    const link = node.querySelector('[data-action]');
    link.href = action.href;
    link.textContent = action.text;
    link.hidden = false;
  }
  if (kind === 'error') {
    const retry = node.querySelector('[data-retry]');
    if (onRetry) retry.addEventListener('click', onRetry, { once: true });
    else retry.hidden = true;
  }
  container.replaceChildren(node);
}

/**
 * Загрузка списка: скелетоны или «Загрузка…» → элементы / пустое состояние / ошибка с кнопкой «Повторить».
 * Повтор выполняется только по нажатию — без автоматических циклов запросов.
 *
 * @param {object} options
 * @param {HTMLElement} options.list     куда вставлять элементы
 * @param {HTMLElement} options.status   куда выводить состояние
 * @param {number} [options.skeletons]   сколько скелетонов показать (0 — показать «Загрузка…»)
 * @param {string} [options.skeletonTemplate]
 * @param {string} [options.loadingText]
 * @param {() => Promise<any>} options.load
 * @param {(data: any) => Element[]} options.render
 * @param {(data: any) => {text: string, action?: {href: string, text: string}}} [options.empty]
 */
export function loadList({
  list,
  status,
  skeletons = 0,
  skeletonTemplate = 'tpl-skeleton-card',
  loadingText = 'Загрузка…',
  load,
  render,
  empty,
}) {
  const run = async () => {
    list.setAttribute('aria-busy', 'true');
    if (skeletons > 0) {
      setState(status, null);
      list.replaceChildren(...Array.from({ length: skeletons }, () => cloneTemplate(skeletonTemplate)));
    } else {
      list.replaceChildren();
      setState(status, 'loading', { text: loadingText });
    }

    try {
      const data = await load();
      const nodes = render(data);
      list.replaceChildren(...nodes);
      setState(status, nodes.length || !empty ? null : 'empty', nodes.length || !empty ? {} : empty(data));
      return data;
    } catch (error) {
      list.replaceChildren();
      setState(status, 'error', { text: error?.message || 'Не удалось загрузить данные.', onRetry: run });
      return undefined;
    } finally {
      list.removeAttribute('aria-busy');
    }
  };
  return run();
}
