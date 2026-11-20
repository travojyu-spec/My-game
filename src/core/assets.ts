import embedded from 'virtual:embedded-assets';

export interface ManifestImage {
  key: string;
  url: string;
  width: number;
  height: number;
}

export interface Placement {
  id?: string;
  label?: string;
  texture: string;
  x: number;
  y: number;
  origin_x: number;
  origin_y: number;
}

export interface Manifest {
  viewport: { width: number; height: number };
  images: ManifestImage[];
  font: { family: string; url: string; css: string; compact_size: number; body_size: number };
  world_layers: Placement[];
  party: Placement[];
  enemies: Placement[];
}

export const MANIFEST_URL = 'assets/manifest.json';
export const CG_MANIFEST_URL = 'assets/chatgpt/manifest.json';

/** Герой из поставки ChatGPT: крупный оригинал, опорная точка и непрозрачная область. */
export interface CgHero {
  id: string; name: string; texture: string; width: number; height: number;
  opaque_bounds: { x: number; y: number; width: number; height: number };
  origin_x: number; origin_y: number; facing?: string;
}
export interface CgManifest { images: (ManifestImage & { sha256?: string })[]; heroes: CgHero[]; variants: Record<string, string[]> }
export const embeddedCg: CgManifest | null = embedded?.cg ?? null;
/** Ключи каталога ChatGPT, которые игра загружает. */
export const usedCg = (key: string) => !key.startsWith('cg/opening/');

/** Встроенные ассеты есть только в однофайловой сборке. */
export const embeddedManifest: Manifest | null = embedded?.manifest ?? null;

/**
 * Путь к файлу ассета. В обычной сборке — относительный путь от страницы
 * (работает в корне сайта и в подпапке), в однофайловой — data URI.
 */
export function assetUrl(path: string): string {
  return embedded?.files[path] ?? path;
}

/** Ждёт загрузки Tiny5 до создания текста. Не блокирует игру дольше 4 секунд. */
export async function loadFont(family = 'Tiny5'): Promise<boolean> {
  if (!('fonts' in document)) return false;
  const sample = 'Ёё АБВ abc 0123';
  const timeout = new Promise<boolean>((r) => setTimeout(() => r(false), 4000));
  const load = Promise.all([
    document.fonts.load(`16px "${family}"`, sample),
    document.fonts.load(`24px "${family}"`, sample),
  ]).then(() => document.fonts.check(`16px "${family}"`, sample));
  return Promise.race([load, timeout]).catch(() => false);
}
