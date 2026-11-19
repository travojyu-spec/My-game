// Прогресс игрока: сохранение, рост героев, сбор боя и награды.
import { Engine, type BattleState, type Unit } from '../battle/core';
import { ENEMIES, setSpawnHook } from '../data/enemies';
import { HERO, HEROES, teamFlags, type HeroDef, type StatMods } from '../data/kit';
import '../data/heroesA';
import '../data/heroesB';
import { EVENTS, REGIONS, START_HEROES, type Effect, type Region, type Stage } from '../data/regions';

export const SAVE_KEY = 'anime-party/save-v1';
export const MAX_LEVEL = 50;
export const PARTY_SIZE = 4;
/** Общая сложность: множитель силы врагов. */
export const ENEMY_ATK = 1.35;

export interface HeroSave { level: number; xp: number; nodes: string[]; hp: number; weapon: number; armor: number }

export interface Save {
  v: 1;
  gold: number;
  region: number;
  maxRegion: number;
  /** Пройденные этапы: region → индексы. */
  done: Record<number, number[]>;
  heroes: Record<string, HeroSave>;
  party: string[];
  items: Record<string, number>;
  kills: Record<string, number>;
  /** Награда за задание получена (region → 1). */
  bounty: Record<number, number>;
  /** Сколько монстров задания было убито на момент взятия. */
  bountyBase: Record<number, number>;
  seed: number;
  battles: number;
  ended: boolean;
  /** Где стоит отряд на карте региона. */
  at: Record<number, number>;
  /** Вступление региона показано. */
  seen: Record<number, number>;
}

export function newSave(): Save {
  const s: Save = {
    v: 1, gold: 60, region: 1, maxRegion: 1, done: {}, heroes: {}, party: [], items: { potion: 3, ether: 1 },
    kills: {}, bounty: {}, bountyBase: {}, seed: (Math.random() * 2 ** 31) | 0, battles: 0, ended: false, at: {}, seen: {},
  };
  for (const k of START_HEROES) addHero(s, k, 1);
  return s;
}

export function loadSave(): Save | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Save;
    if (s.v !== 1) return null;
    s.bountyBase ??= {};
    s.at ??= {};
    s.seen ??= {};
    return s;
  } catch {
    return null;
  }
}
export function writeSave(s: Save): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch { /* приватный режим */ }
}
export function deleteSave(): void { try { localStorage.removeItem(SAVE_KEY); } catch { /* */ } }

// ---------- Герои ----------

export function addHero(s: Save, key: string, level: number): boolean {
  if (s.heroes[key] || !HERO[key]) return false;
  s.heroes[key] = { level, xp: 0, nodes: [], hp: 1, weapon: 0, armor: 0 };
  if (s.party.length < PARTY_SIZE) s.party.push(key);
  return true;
}

export const xpToNext = (lvl: number) => 40 + 20 * lvl;
export const pointsAt = (lvl: number) => Math.floor(lvl / 2);
export const freePoints = (h: HeroSave) => pointsAt(h.level) - h.nodes.length;

export function sumMods(d: HeroDef, nodes: string[]): Required<StatMods> {
  const m = { hp: 0, atk: 0, def: 0, dodge: 0, crit: 0, spd: 0, mp: 0 };
  for (const n of nodes) {
    const x = d.mods?.[n];
    if (x) for (const k of Object.keys(x) as (keyof StatMods)[]) m[k] += x[k] ?? 0;
  }
  return m;
}

export interface HeroStats { maxHp: number; atk: number; def: number; spd: number; maxMp: number; dodge: number; crit: number }
export function heroStats(key: string, h: HeroSave): HeroStats {
  const d = HERO[key];
  const m = sumMods(d, h.nodes);
  return {
    maxHp: Math.round(d.hp * (1 + 0.09 * (h.level - 1)) * (1 + 0.06 * h.armor) * (1 + m.hp)),
    atk: Math.round(d.atk * (1 + 0.07 * (h.level - 1)) * (1 + 0.06 * h.weapon) * (1 + m.atk)),
    def: Math.min(0.7, d.def + m.def),
    spd: d.spd + m.spd,
    maxMp: d.mp + m.mp,
    dodge: Math.min(0.6, (d.dodge ?? 0) + m.dodge),
    crit: 0.05 + (d.crit ?? 0) + m.crit,
  };
}

/** Можно ли взять узел дерева (по порядку внутри ветки). */
export function canBuy(h: HeroSave, id: string): string | null {
  if (h.nodes.includes(id)) return 'Уже изучено.';
  const br = id[0];
  const i = Number(id.slice(1));
  if (i > 1 && !h.nodes.includes(br + (i - 1))) return 'Сначала предыдущий навык ветки.';
  if (freePoints(h) <= 0) return 'Нет очков навыков (1 очко за каждые 2 уровня).';
  return null;
}

export function gainXp(s: Save, key: string, n: number): number {
  const h = s.heroes[key];
  let ups = 0;
  if (h.level >= MAX_LEVEL) return 0;
  h.xp += Math.round(n);
  while (h.level < MAX_LEVEL && h.xp >= xpToNext(h.level)) {
    h.xp -= xpToNext(h.level);
    h.level += 1;
    ups += 1;
  }
  return ups;
}

export function partyLevel(s: Save): number {
  const l = Object.values(s.heroes).map((h) => h.level);
  return l.length ? Math.max(...l) : 1;
}

// ---------- Регионы ----------

export const regionOf = (id: number): Region => REGIONS[id - 1];
export function isDone(s: Save, r: number, i: number): boolean { return (s.done[r] ?? []).includes(i); }
/** Этап открыт: пройден или следующий за последним пройденным. */
export function isOpen(s: Save, r: number, i: number): boolean {
  if (r > s.maxRegion) return false;
  if (i === 0) return true;
  return isDone(s, r, i) || isDone(s, r, i - 1);
}
export function markDone(s: Save, r: number, i: number): void {
  const l = (s.done[r] ??= []);
  if (!l.includes(i)) l.push(i);
}

/** Присоединение героя на этапе. Возвращает реплику или null. */
export function tryJoin(s: Save, st: Stage): string | null {
  if (!st.join || s.heroes[st.join]) return null;
  addHero(s, st.join, Math.max(1, partyLevel(s) - 1));
  return st.joinText ?? `${HERO[st.join].name} присоединяется к отряду!`;
}

// ---------- Сборка боя ----------

let uidN = 0;
function heroUnit(s: Save, key: string, pos: number): Unit {
  const d = HERO[key];
  const h = s.heroes[key];
  const st = heroStats(key, h);
  const hp = Math.max(1, Math.round(st.maxHp * Math.max(0, Math.min(1, h.hp))));
  return {
    uid: 'h' + pos, key, side: 'hero', name: d.name, nameAcc: d.nameAcc, pos, level: h.level,
    maxHp: st.maxHp, hp, atk: st.atk, def: st.def, spd: st.spd, maxMp: st.maxMp, mp: st.maxMp, mpRegen: d.mpRegen, mpName: d.mpName,
    dodge: st.dodge, crit: st.crit, limit: 0, alive: true, statuses: [], res: {}, cd: {}, uses: {},
    nodes: [...h.nodes], tags: [...(d.tags ?? [])], resist: { ...(d.resist ?? {}) }, boss: false, xp: 0, gold: 0,
  };
}

export function enemyUnit(key: string, pos: number, elite = false): Unit {
  const d = ENEMIES[key];
  const r = d.region;
  const hpK = (1 + 0.25 * (r - 1)) * (elite ? 1.2 : 1) * (d.boss ? 0.75 : 1);
  const atkK = (1 + 0.22 * (r - 1)) * ENEMY_ATK;
  const maxHp = Math.round(d.hp * hpK);
  return {
    uid: 'e' + uidN++, key, side: 'enemy', name: d.name, nameAcc: d.nameAcc, pos, level: r * 3 + (d.boss ? 2 : 0),
    maxHp, hp: maxHp, atk: Math.round(d.atk * atkK), def: d.def, spd: d.spd, maxMp: 0, mp: 0, mpRegen: 0, mpName: '',
    dodge: d.dodge ?? 0, crit: d.crit ?? 0.05, limit: 0, alive: true, statuses: [], res: {}, cd: {}, uses: {},
    nodes: [], tags: [...d.tags], resist: { ...(d.resist ?? {}) }, boss: !!d.boss,
    xp: 10 * r * (d.boss ? 5 : 1) * (elite ? 1.5 : 1), gold: 6 * r * (d.boss ? 8 : 1) * (elite ? 1.5 : 1),
  };
}

setSpawnHook((e: Engine, key: string, by: Unit) => {
  const used = new Set(e.alliesOf(by).map((x) => x.pos));
  let pos = 0;
  while (used.has(pos)) pos++;
  if (pos > 4) return;
  const u = enemyUnit(key, pos);
  u.xp = Math.round(u.xp * 0.5);
  u.gold = Math.round(u.gold * 0.5);
  e.s.units.push(u);
  e.ev.push({ k: 'spawn', uid: u.uid });
  e.kit(u).hooks.battleStart?.(e, u);
  e.float(u, 'подкрепление!', '#ff9a6a');
});

export interface BattleSetup { state: BattleState; region: number; stage: number | null; kind: 'battle' | 'elite' | 'boss' | 'hunt' | 'event'; bg: string | null; title: string }

export function makeBattle(s: Save, region: number, enemies: string[], kind: BattleSetup['kind'], stage: number | null, title: string): BattleSetup {
  uidN = 0;
  const heroes = s.party.filter((k) => s.heroes[k]).map((k, i) => heroUnit(s, k, i));
  const foes = enemies.map((k, i) => enemyUnit(k, i, kind === 'elite'));
  s.seed = (s.seed * 1103515245 + 12345) & 0x7fffffff;
  const state: BattleState = {
    v: 1, round: 0, order: [], turn: 0, extra: [], cur: heroes[0].uid, units: [...heroes, ...foes],
    seed: s.seed, result: 'ongoing', field: [], team: teamFlags(s.party), items: { ...s.items }, region,
  };
  return { state, region, stage, kind, bg: regionOf(region).bg, title };
}

/** Случайная охота в регионе: 2–4 обычных врага. */
export function huntEnemies(s: Save, region: number): string[] {
  const pool = regionOf(region).pool.filter((k) => !ENEMIES[k].boss && k !== 'gluttony' && k !== 'sea_king');
  s.seed = (s.seed * 1103515245 + 12345) & 0x7fffffff;
  const n = 2 + (s.seed % 3);
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    s.seed = (s.seed * 1103515245 + 12345) & 0x7fffffff;
    out.push(pool[s.seed % pool.length]);
  }
  return out;
}

// ---------- Итоги боя ----------

export interface BattleResult {
  victory: boolean;
  xp: number; gold: number;
  levelUps: { key: string; level: number }[];
  drops: string[];
  joins: string[];
  regionDone: boolean;
  lostGold: number;
}

export function applyResult(s: Save, setup: BattleSetup, st: BattleState): BattleResult {
  const e = new Engine(st);
  const victory = st.result === 'victory';
  const res: BattleResult = { victory, xp: 0, gold: 0, levelUps: [], drops: [], joins: [], regionDone: false, lostGold: 0 };
  s.items = { ...st.items };
  s.battles += 1;
  const heroes = st.units.filter((u) => u.side === 'hero');
  if (!victory) {
    res.lostGold = Math.floor(s.gold * 0.1);
    s.gold -= res.lostGold;
    for (const k of Object.keys(s.heroes)) s.heroes[k].hp = 1;
    return res;
  }
  const foes = st.units.filter((u) => u.side === 'enemy');
  for (const f of foes) s.kills[f.key] = (s.kills[f.key] ?? 0) + 1;
  let xp = foes.reduce((a, f) => a + f.xp, 0);
  let gold = foes.reduce((a, f) => a + f.gold, 0);
  const ban = heroes.find((h) => h.key === 'ban');
  if (ban) { gold += ban.res.gold ?? 0; if (ban.nodes.includes('C1')) gold *= 1.1; }
  const roxy = heroes.find((h) => h.key === 'roxy');
  if (roxy?.nodes.includes('C3')) xp *= 1.15;
  if (setup.kind === 'hunt') { xp *= 0.8; gold *= 0.8; }
  res.xp = Math.round(xp);
  res.gold = Math.round(gold);
  s.gold += res.gold;
  for (const k of Object.keys(s.heroes)) {
    const inParty = s.party.includes(k);
    const ups = gainXp(s, k, inParty ? res.xp : res.xp * 0.5);
    if (ups) res.levelUps.push({ key: k, level: s.heroes[k].level });
  }
  // Здоровье переносится между боями; павшие встают с 1 ОЗ.
  const senshi = heroes.some((h) => h.key === 'senshi' && h.alive);
  for (const u of heroes) {
    let frac = u.alive ? u.hp / u.maxHp : 0.01;
    if (senshi) frac += 0.1;
    s.heroes[u.key].hp = Math.min(1, frac);
  }
  // Трофеи
  const rnd = () => { s.seed = (s.seed * 1103515245 + 12345) & 0x7fffffff; return (s.seed % 1000) / 1000; };
  if (rnd() < 0.2) res.drops.push('potion');
  if (setup.kind === 'elite' || setup.kind === 'boss') res.drops.push(rnd() < 0.5 ? 'phoenix' : 'scroll');
  if (setup.kind === 'boss') res.drops.push('ether');
  for (const d of res.drops) s.items[d] = Math.min(9, (s.items[d] ?? 0) + 1);
  if (setup.stage !== null) {
    const stage = regionOf(setup.region).stages[setup.stage];
    markDone(s, setup.region, setup.stage);
    const j = tryJoin(s, stage);
    if (j) res.joins.push(j);
    if (setup.kind === 'boss' && setup.region === s.maxRegion) {
      res.regionDone = true;
      if (s.maxRegion < REGIONS.length) s.maxRegion += 1;
      else s.ended = true;
    }
  }
  void e;
  return res;
}

// ---------- События ----------

export interface EventOutcome { text: string; fight?: string[] }

export function applyEffects(s: Save, region: number, fx: Effect[], rnd: () => number): EventOutcome {
  const lines: string[] = [];
  let fight: string[] | undefined;
  const k = 1 + 0.5 * (region - 1);
  for (const f of fx) {
    switch (f.k) {
      case 'heal': for (const h of Object.values(s.heroes)) h.hp = Math.min(1, h.hp + f.v); break;
      case 'hurt': for (const k2 of s.party) s.heroes[k2].hp = Math.max(0.05, s.heroes[k2].hp - f.v); break;
      case 'gold': s.gold += Math.round(f.v * k); lines.push(`+${Math.round(f.v * k)} золота`); break;
      case 'item': s.items[f.id] = Math.min(9, (s.items[f.id] ?? 0) + f.n); lines.push(`+${f.n} × ${ITEM_NAME[f.id] ?? f.id}`); break;
      case 'xp': {
        const n = Math.round(f.v * k);
        for (const key of s.party) gainXp(s, key, n);
        lines.push(`+${n} опыта отряду`);
        break;
      }
      case 'fight': fight = f.enemies; break;
      case 'chance': {
        const ok = rnd() < f.p;
        lines.push(ok ? f.okText : f.failText);
        const r = applyEffects(s, region, ok ? f.ok : f.fail, rnd);
        if (r.text) lines.push(r.text);
        if (r.fight) fight = r.fight;
        break;
      }
    }
  }
  return { text: lines.join('\n'), fight };
}

export const ITEM_NAME: Record<string, string> = {
  potion: 'Зелье лечения', ether: 'Эликсир маны', bomb: 'Бомба', phoenix: 'Перо феникса', scroll: 'Свиток защиты',
};

export { EVENTS, HEROES, REGIONS };
