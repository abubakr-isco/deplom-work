import { API_BASE, API_CONFIGURED } from '../config.js';
import { session } from '../state/session.js';
import { demoResponse } from './demo.js';

/** Ошибка запроса к API с HTTP-статусом (0 — сеть или неверная настройка адреса). */
export class ApiError extends Error {
  constructor(status, message, details = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
  }
}

const MISCONFIGURED_MESSAGE = API_CONFIGURED
  ? 'Сервер API ответил не в формате JSON. Проверьте адрес API в .env.local.'
  : 'Адрес сервера API не задан. Укажите API_PROXY_TARGET или VITE_API_ORIGIN в файле .env.local и перезапустите сайт.';

const NETWORK_MESSAGE = API_CONFIGURED
  ? 'Нет связи с сервером API. Проверьте интернет и что сервер запущен.'
  : MISCONFIGURED_MESSAGE;

const STATUS_MESSAGES = {
  400: 'Проверьте введённые данные.',
  401: 'Сессия завершена или недействительна. Войдите снова.',
  403: 'Это действие вам недоступно.',
  404: 'Запрошенные данные не найдены.',
  409: 'Действие невозможно из-за ограничений магазина.',
  429: 'Слишком много запросов: лимит API — 120 в минуту. Подождите минуту и попробуйте снова.',
};

function buildUrl(path, query) {
  const url = new URL(API_BASE + path, window.location.origin);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value));
      }
    }
  }
  return url.toString();
}

function useDemo(result) {
  if (result?.status >= 400) throw new ApiError(result.status, result.data?.message || 'Ошибка деморежима.', result.data);
  return result;
}

async function readBody(response) {
  const text = await response.text();
  if (!text) return { kind: 'empty', data: null };
  const type = response.headers.get('content-type') || '';
  if (type.includes('json')) {
    try {
      return { kind: 'json', data: JSON.parse(text) };
    } catch {
      return { kind: 'invalid', data: null };
    }
  }
  return { kind: 'other', data: null };
}

/**
 * Запрос к Sandbox Shop API.
 * @param {string} path путь после /sandbox-shop, например "/products"
 * @param {{method?: string, body?: unknown, auth?: boolean, query?: object, signal?: AbortSignal, keepalive?: boolean}} options
 */
export async function request(path, { method = 'GET', body, auth = false, query, signal, keepalive = false } = {}) {
  const headers = { Accept: 'application/json' };
  let token = null;

  if (auth) {
    token = session.token;
    if (!token) throw new ApiError(401, 'Войдите в аккаунт, чтобы продолжить.');
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const demoOptions = { method, body, query, token: session.token };
  const local = demoResponse(path, demoOptions);
  if (local !== null) return useDemo(local);

  let response;
  try {
    response = await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
      keepalive,
    });
  } catch (error) {
    if (error?.name === 'AbortError') throw error;
    const fallback = demoResponse(path, { ...demoOptions, fallback: true });
    if (fallback !== null) return useDemo(fallback);
    throw new ApiError(0, NETWORK_MESSAGE);
  }

  const { kind, data } = await readBody(response);

  // HTML или другой формат вместо JSON — почти всегда неверный адрес API.
  // Настоящий API отвечает JSON и на ошибки ({ message }), поэтому 404 без JSON — тоже признак неверного адреса.
  if (
    kind === 'other' ||
    kind === 'invalid' ||
    (!response.ok && kind === 'empty' && (response.status === 404 || !API_CONFIGURED))
  ) {
    const fallback = demoResponse(path, { ...demoOptions, fallback: true });
    if (fallback !== null) return useDemo(fallback);
    throw new ApiError(0, MISCONFIGURED_MESSAGE);
  }

  if (!response.ok) {
    const serverMessage = typeof data?.message === 'string' ? data.message.trim() : '';

    if (response.status === 401 && auth) {
      // Токен истёк или сессия завершена (logout) — сбрасываем её, если она не поменялась за время запроса.
      if (session.token === token) session.expire();
      throw new ApiError(401, STATUS_MESSAGES[401], data);
    }

    const fallback =
      STATUS_MESSAGES[response.status] ??
      (response.status >= 500 ? 'Ошибка на сервере. Попробуйте позже.' : `Ошибка запроса (${response.status}).`);
    const message = response.status === 429 || !serverMessage ? fallback : serverMessage;
    throw new ApiError(response.status, message, data);
  }

  return data;
}

/** Текст ошибки для показа пользователю. */
export function errorMessage(error, fallback = 'Что-то пошло не так. Попробуйте ещё раз.') {
  if (error instanceof ApiError) return error.message;
  return fallback;
}

export function isAbort(error) {
  return error?.name === 'AbortError';
}
