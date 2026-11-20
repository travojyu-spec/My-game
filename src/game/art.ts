// Связь героев и монстров игры с утверждённой графикой ChatGPT.
// Оригиналы не меняются: размер под экран подбирается в игре при загрузке.
import type { CgHero, CgManifest } from '../core/assets';

/** Герой игры → id героя в каталоге ChatGPT. */
const HERO_IDS: Record<string, string> = {
  frieren: 'frieren', fern: 'fern', stark: 'stark', megumin: 'megumin', gs: 'goblin_slayer',
  asta: 'asta', guts: 'guts', edward: 'edward', alucard: 'alucard', aqua: 'aqua', darkness: 'darkness',
  escanor: 'escanor', zoro: 'zoro', sanji: 'sanji', luffy: 'luffy', yami: 'yami', meliodas: 'meliodas',
  ban: 'ban', sylphy: 'sylphie', roxy: 'roxy',
};

/** Монстр игры → одобренный пиксельный спрайт. */
export const ENEMY_ART: Record<string, string> = {
  goblin: 'cg/approved/enemies/goblin_2',
  goblin_shaman: 'cg/approved/enemies/goblin_2',
  walking_mushroom: 'cg/approved/enemies/brute_1',
  mandrake: 'cg/approved/enemies/healer_2',
};

/** Иконки прототипа → одобренные версии. */
export const ICON_ART: Record<string, string> = {
  'ui/icons/sword': 'cg/approved/icons/attack_1',
  'ui/icons/fire': 'cg/approved/icons/fire_3',
  'ui/icons/shield': 'cg/approved/icons/shield_1',
  'ui/icons/potion': 'cg/approved/icons/potion_1',
};

/** Фоны регионов, для которых есть одобренный рисунок. */
export const BG_ART: Record<string, string> = { 'world/forest_path': 'cg/approved/backgrounds/forest_1' };

const heroes = new Map<string, CgHero>();
export function setHeroArt(cg: CgManifest): void {
  for (const [key, id] of Object.entries(HERO_IDS)) {
    const h = cg.heroes.find((x) => x.id === id);
    if (h) heroes.set(key, h);
  }
}
export function heroArt(key: string): CgHero | undefined { return heroes.get(key); }
