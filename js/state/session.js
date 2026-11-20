/**
 * Сессия пользователя: токен и профиль.
 * Хранится в localStorage, чтобы вход сохранялся после перезагрузки страницы.
 */
const STORAGE_KEY = 'sandbox-shop.session';

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    return parsed && typeof parsed.token === 'string' && parsed.token ? parsed : null;
  } catch {
    return null;
  }
}

function persist(value) {
  try {
    if (value) localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage может быть недоступен (приватный режим) — сессия будет жить до перезагрузки.
  }
}

let state = load();
const listeners = new Set();

function emit(reason) {
  for (const listener of listeners) listener(reason);
}

export const session = {
  get token() {
    return state?.token ?? null;
  },
  get user() {
    return state?.user ?? null;
  },
  get isAuthenticated() {
    return Boolean(state?.token);
  },
  /** После /login или /register. */
  start({ token, user }) {
    state = { token, user: user ?? null };
    persist(state);
    emit('login');
  },
  updateUser(user) {
    if (!state || !user) return;
    state = { ...state, user };
    persist(state);
    emit('user');
  },
  /** Выход по кнопке. */
  clear() {
    if (!state) return;
    state = null;
    persist(null);
    emit('logout');
  },
  /** Сервер ответил 401 — токен больше не действует. */
  expire() {
    if (!state) return;
    state = null;
    persist(null);
    emit('expired');
  },
  subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

// Синхронизация между вкладками: вход/выход в одной вкладке отражается в других.
window.addEventListener('storage', (event) => {
  if (event.key !== STORAGE_KEY) return;
  const next = load();
  const changed = next?.token !== state?.token;
  state = next;
  if (changed) emit(next ? 'login' : 'logout');
});

export function fullName(user) {
  return [user?.name, user?.surname].filter(Boolean).join(' ').trim();
}
