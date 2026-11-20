import '../app.js';
import { errorMessage } from '../api/client.js';
import { api } from '../api/shop.js';
import { session } from '../state/session.js';
import { $, safeRedirect, setBusy, urlWith } from '../ui/dom.js';
import { EMAIL_RE, clearErrors, fieldValue, focusFirstInvalid, setFieldError, showFormAlert } from '../ui/form.js';
import { flashToast } from '../ui/toast.js';

const query = new URLSearchParams(window.location.search);
const redirect = query.get('redirect') ?? '';

if (session.isAuthenticated) {
  $('[data-logged-in]').hidden = false;
  $('[data-guest-view]').hidden = true;
} else {
  $('[data-expired]').hidden = query.get('reason') !== 'expired';
  $('[data-switch-link]').href = urlWith('/register.html', { redirect });

  const form = $('.auth__form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    const email = fieldValue(form, 'email').trim();
    const password = fieldValue(form, 'password');

    let valid = true;
    if (!EMAIL_RE.test(email)) {
      setFieldError(form, 'email', 'Введите email в формате name@example.com.');
      valid = false;
    }
    if (!password) {
      setFieldError(form, 'password', 'Введите пароль.');
      valid = false;
    }
    if (!valid) {
      focusFirstInvalid(form);
      return;
    }

    const submit = form.querySelector('[type="submit"]');
    setBusy(submit, true, 'Входим…');
    try {
      const data = await api.login({ email, password });
      if (!data?.token) throw new Error('В ответе сервера нет токена.');
      session.start({ token: data.token, user: data.user ?? null });
      flashToast('Вы вошли в аккаунт', 'success');
      window.location.replace(safeRedirect(redirect));
    } catch (error) {
      showFormAlert(form, errorMessage(error, 'Не удалось войти. Попробуйте ещё раз.'));
      setBusy(submit, false);
    }
  });
}
