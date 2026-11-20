import '../app.js';
import { errorMessage } from '../api/client.js';
import { api } from '../api/shop.js';
import { session } from '../state/session.js';
import { $, safeRedirect, setBusy, urlWith } from '../ui/dom.js';
import { EMAIL_RE, clearErrors, fieldValue, focusFirstInvalid, setFieldError, showFormAlert } from '../ui/form.js';
import { flashToast } from '../ui/toast.js';

const redirect = new URLSearchParams(window.location.search).get('redirect') ?? '';

function validate(values, repeatPassword) {
  const errors = {};
  if (!values.name) errors.name = 'Введите имя.';
  if (!values.surname) errors.surname = 'Введите фамилию.';
  if (!EMAIL_RE.test(values.email)) errors.email = 'Введите email в формате name@example.com.';
  const digits = values.phone.replace(/\D/g, '');
  if (digits.length < 9 || digits.length > 15 || /[^\d\s()+-]/.test(values.phone))
    errors.phone = 'Введите номер телефона, например +998 90 123-45-67.';
  if (!values.password) errors.password = 'Придумайте пароль.';
  if (repeatPassword !== values.password) errors.password2 = 'Пароли не совпадают.';
  return errors;
}

if (session.isAuthenticated) {
  $('[data-logged-in]').hidden = false;
  $('[data-guest-view]').hidden = true;
} else {
  $('[data-switch-link]').href = urlWith('/login.html', { redirect });

  const form = $('.auth__form');
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearErrors(form);
    const values = {
      name: fieldValue(form, 'name').trim(),
      surname: fieldValue(form, 'surname').trim(),
      email: fieldValue(form, 'email').trim(),
      phone: fieldValue(form, 'phone').trim(),
      password: fieldValue(form, 'password'),
    };
    const errors = validate(values, fieldValue(form, 'password2'));
    for (const [name, message] of Object.entries(errors)) setFieldError(form, name, message);
    if (Object.keys(errors).length) {
      focusFirstInvalid(form);
      return;
    }

    const submit = form.querySelector('[type="submit"]');
    setBusy(submit, true, 'Создаём аккаунт…');
    try {
      const data = await api.register(values);
      if (!data?.token) throw new Error('В ответе сервера нет токена.');
      session.start({ token: data.token, user: data.user ?? null });
      flashToast('Аккаунт создан. Помните: учебные данные удаляются через 45 дней.', 'success');
      window.location.replace(safeRedirect(redirect));
    } catch (error) {
      const message =
        error?.status === 409
          ? `${errorMessage(error)} Если аккаунт уже есть — войдите.`
          : errorMessage(error, 'Не удалось зарегистрироваться.');
      showFormAlert(form, message);
      setBusy(submit, false);
    }
  });
}
