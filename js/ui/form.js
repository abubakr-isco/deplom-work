/* Ошибки в формах: разметка полей и мест для ошибок лежит в HTML (id="field-<name>-error"). */

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function fieldValue(form, name) {
  return form.elements.namedItem(name)?.value ?? '';
}

export function setFieldError(form, name, message) {
  const input = form.elements.namedItem(name);
  const error = form.querySelector(`#field-${name}-error`);
  if (!input || !error) return;
  error.textContent = message || '';
  error.hidden = !message;
  input.setAttribute('aria-invalid', message ? 'true' : 'false');
}

export function clearErrors(form) {
  for (const error of form.querySelectorAll('.field__error')) {
    error.hidden = true;
    error.textContent = '';
  }
  for (const input of form.querySelectorAll('[aria-invalid]')) input.setAttribute('aria-invalid', 'false');
  const alert = form.querySelector('[data-form-alert]');
  if (alert) {
    alert.hidden = true;
    alert.textContent = '';
  }
}

export function showFormAlert(form, message) {
  const alert = form.querySelector('[data-form-alert]');
  if (!alert) return;
  alert.textContent = message;
  alert.hidden = false;
  alert.focus();
}

export function focusFirstInvalid(form) {
  form.querySelector('[aria-invalid="true"]')?.focus();
}
