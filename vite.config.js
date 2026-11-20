import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';

const ROOT = path.dirname(fileURLToPath(import.meta.url));

/** HTML-страницы сайта (каждая — отдельный файл в корне проекта). */
const PAGES = ['index', 'catalog', 'product', 'cart', 'login', 'register', 'profile', 'info', '404'];

/**
 * Подключение общих кусков HTML (шапка, подвал, шаблоны):
 * <!-- @include partials/header.html --> заменяется содержимым файла.
 */
function htmlIncludes() {
  const pattern = /<!--\s*@include\s+([\w./-]+)\s*-->/g;
  const expand = (html, depth = 0) =>
    html.replace(pattern, (_, file) => {
      if (depth > 5) throw new Error('Слишком глубокая вложенность @include');
      return expand(fs.readFileSync(path.resolve(ROOT, file), 'utf8'), depth + 1);
    });

  return {
    name: 'html-includes',
    transformIndexHtml: { order: 'pre', handler: (html) => expand(html) },
    handleHotUpdate({ file, server }) {
      if (file.startsWith(path.join(ROOT, 'partials'))) {
        server.ws.send({ type: 'full-reload' });
        return [];
      }
      return undefined;
    },
  };
}

/**
 * Адрес API задаётся в .env.local (см. .env.example):
 * API_PROXY_TARGET — прокси Vite для /sandbox-shop (dev и preview, CORS не нужен);
 * VITE_API_ORIGIN  — прямой адрес сервера для браузера (нужен CORS), используется и в сборке.
 */
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ROOT, '');
  // Адрес сервера без /sandbox-shop: прокси сам сохраняет путь запроса /sandbox-shop/...
  const proxyTarget = (env.API_PROXY_TARGET || '').trim().replace(/\/+$/, '').replace(/\/sandbox-shop$/, '');
  const proxy = proxyTarget ? { '/sandbox-shop': { target: proxyTarget, changeOrigin: true } } : undefined;

  return {
    appType: 'mpa',
    plugins: [htmlIncludes()],
    define: {
      __API_PROXY_CONFIGURED__: JSON.stringify(Boolean(proxyTarget)),
    },
    server: { proxy },
    preview: { proxy },
    build: {
      target: 'es2022',
      rollupOptions: {
        input: Object.fromEntries(PAGES.map((name) => [name, path.resolve(ROOT, `${name}.html`)])),
      },
    },
  };
});
