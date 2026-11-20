import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const PUBLIC = resolve(import.meta.dirname, 'public');
const VIRTUAL = 'virtual:embedded-assets';
/** Из каталога ChatGPT игре нужны герои, одобренный набор и эффекты (картинки вступления — нет). */
const USED_CG = (key: string) => !key.startsWith('cg/opening/');

const MIME: Record<string, string> = { png: 'image/png', ttf: 'font/ttf', json: 'application/json' };

function dataUri(rel: string): string {
  const ext = rel.split('.').pop()!.toLowerCase();
  const b64 = readFileSync(resolve(PUBLIC, rel)).toString('base64');
  return `data:${MIME[ext] ?? 'application/octet-stream'};base64,${b64}`;
}

/**
 * Обычная сборка: ассеты лежат файлами в dist/assets и грузятся по относительным путям.
 * Режим single: все картинки, шрифт и manifest встраиваются в один index.html,
 * который открывается даже с диска (file://) без сервера и интернета.
 */
function embeddedAssets(single: boolean): Plugin {
  return {
    name: 'embedded-assets',
    resolveId(id) {
      return id === VIRTUAL ? '\0' + VIRTUAL : null;
    },
    load(id) {
      if (id !== '\0' + VIRTUAL) return null;
      if (!single) return 'export default null;';
      // Два каталога: прежние ассеты прототипа и утверждённая графика ChatGPT.
      const manifest = JSON.parse(readFileSync(resolve(PUBLIC, 'assets/manifest.json'), 'utf8'));
      const cg = JSON.parse(readFileSync(resolve(PUBLIC, 'assets/chatgpt/manifest.json'), 'utf8'));
      const files: Record<string, string> = {};
      for (const img of manifest.images) files[img.url] = dataUri(img.url);
      for (const img of cg.images) if (USED_CG(img.key)) files[img.url] = dataUri(img.url);
      files[manifest.font.url] = dataUri(manifest.font.url);
      return `export default ${JSON.stringify({ manifest, cg, files })};`;
    },
    transformIndexHtml(html) {
      if (!single) return html;
      const css = readFileSync(resolve(PUBLIC, 'assets/fonts/fonts.css'), 'utf8').replace(
        './Tiny5.ttf',
        dataUri('assets/fonts/Tiny5.ttf'),
      );
      return html.replace(/<link[^>]+fonts\.css[^>]*>/, `<style>${css}</style>`);
    },
  };
}

export default defineConfig(({ mode }) => {
  const single = mode === 'single';
  return {
    // Относительные пути: игра работает и в корне сайта, и в подпапке.
    base: './',
    plugins: [embeddedAssets(single), ...(single ? [viteSingleFile()] : [])],
    publicDir: single ? false : 'public',
    build: {
      outDir: single ? 'dist-single' : 'dist',
      assetsDir: 'js',
      target: 'es2020',
      chunkSizeWarningLimit: 2000,
      emptyOutDir: true,
    },
    server: { host: true },
  };
});
