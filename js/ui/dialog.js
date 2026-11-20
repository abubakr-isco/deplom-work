/* Модальные окна: разметка <dialog> лежит в HTML, здесь — только открытие и закрытие. */

const closeHandlers = new WeakMap();

function prepare(dialog) {
  if (dialog.dataset.ready) return;
  dialog.dataset.ready = 'true';

  dialog.addEventListener('click', (event) => {
    if (event.target.closest('[data-dialog-close]')) {
      dialog.close();
      return;
    }
    // Клик по затемнённому фону (вне прямоугольника окна).
    if (event.target === dialog) {
      const rect = dialog.getBoundingClientRect();
      const inside =
        event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
      if (!inside) dialog.close();
    }
  });

  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('has-modal');
    const handler = closeHandlers.get(dialog);
    closeHandlers.delete(dialog);
    handler?.();
  });
}

export function openDialog(dialog, { onClose } = {}) {
  prepare(dialog);
  if (onClose) closeHandlers.set(dialog, onClose);
  else closeHandlers.delete(dialog);
  if (!dialog.open) dialog.showModal();
  document.documentElement.classList.add('has-modal');
  return () => dialog.close();
}

/** Подтверждение через окно #confirm-dialog. Возвращает Promise<boolean>. */
export function confirmDialog({ title, text = '', confirmLabel = 'Подтвердить', danger = false }) {
  const dialog = document.getElementById('confirm-dialog');
  const okButton = dialog.querySelector('[data-confirm-ok]');
  dialog.querySelector('[data-confirm-title]').textContent = title;
  dialog.querySelector('[data-confirm-text]').textContent = text;
  okButton.textContent = confirmLabel;
  okButton.classList.toggle('btn--danger', danger);

  return new Promise((resolve) => {
    let confirmed = false;
    const onOk = () => {
      confirmed = true;
      dialog.close();
    };
    okButton.addEventListener('click', onOk, { once: true });
    openDialog(dialog, {
      onClose: () => {
        okButton.removeEventListener('click', onOk);
        resolve(confirmed);
      },
    });
  });
}
