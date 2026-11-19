import { registerKit, type AbilityDef, type Engine, type Hooks, type Unit } from '../battle/core';

export type Role = 'tank' | 'fighter' | 'mage' | 'support';
export const ROLE_NAME: Record<Role, string> = { tank: 'Защитник', fighter: 'Боец', mage: 'Маг', support: 'Поддержка' };

export interface TreeNode { n: string; t: string }
export type Branch = [string, TreeNode[]];

export interface StatMods { hp?: number; atk?: number; def?: number; dodge?: number; crit?: number; spd?: number; mp?: number }

export interface HeroDef {
  key: string; name: string; nameAcc: string; role: Role; work: string; color: string;
  hp: number; atk: number; def: number; spd: number; mp: number; mpRegen: number; mpName: string;
  dodge?: number; crit?: number; tags?: string[]; resist?: Record<string, number>;
  passive: string;
  tree: { A: Branch; B: Branch; C: Branch };
  mods?: Partial<Record<string, StatMods>>;
  abilities: (e: Engine, u: Unit) => AbilityDef[];
  hooks: Hooks;
  threat?: number;
}

export const HEROES: HeroDef[] = [];
export const HERO: Record<string, HeroDef> = {};

export function hero(d: HeroDef): void {
  HEROES.push(d);
  HERO[d.key] = d;
  registerKit({ key: d.key, abilities: d.abilities, hooks: d.hooks, threat: d.threat });
}

/** Узел дерева взят? */
export const N = (u: Unit, id: string): boolean => u.nodes.includes(id);

export const node = (n: string, t: string): TreeNode => ({ n, t });

export const I = {
  sword: 'ui/icons/sword', shield: 'ui/icons/shield', fire: 'ui/icons/fire', potion: 'ui/icons/potion', bow: 'ui/icons/bow',
};

export const MAGES = ['megumin', 'fern', 'edward', 'rudeus', 'roxy', 'marcille', 'aqua', 'sylphy', 'yami'];

/** Флаги сыгранных компаний по составу отряда. */
export function teamFlags(keys: string[]): string[] {
  const has = (k: string) => keys.includes(k);
  const cnt = (l: string[]) => l.filter(has).length;
  const f: string[] = [];
  const groups: [string, string[]][] = [
    ['konosuba', ['aqua', 'darkness', 'megumin']],
    ['mugi', ['luffy', 'zoro', 'sanji']],
    ['sins', ['meliodas', 'ban', 'escanor']],
    ['mushoku', ['rudeus', 'roxy', 'sylphy']],
    ['bulls', ['asta', 'yami']],
    ['frieren', ['stark', 'fern']],
    ['meshi', ['marcille', 'senshi']],
  ];
  for (const [id, l] of groups) {
    const c = cnt(l);
    if (c >= 2) f.push(id + '2');
    if (c >= 3) f.push(id + '3');
  }
  if (has('aqua') && has('alucard')) f.push('aquaAlucard');
  if (has('escanor') && has('kamina')) f.push('escanorKamina');
  if (has('guts') && has('alucard')) f.push('hunters');
  if (has('sanji') && has('senshi')) f.push('cooks');
  return f;
}

export const TEAM_INFO: { id: string; name: string; heroes: string[]; two: string; three?: string }[] = [
  { id: 'konosuba', name: 'Коносуба', heroes: ['aqua', 'darkness', 'megumin'], two: 'Пока Мэгумин в отрубе, Даркнесс сама провоцирует врагов.', three: 'Аква сокращает отруб Мэгумин на ход, невезение Аквы не срабатывает.' },
  { id: 'mugi', name: 'Мугивары', heroes: ['luffy', 'zoro', 'sanji'], two: '+10% урона Мугиварам.', three: 'Соперники: удары Зоро и Санджи усиливают друг друга до +50%; еда Санджи лечит Луффи вдвое.' },
  { id: 'sins', name: 'Семь смертных грехов', heroes: ['meliodas', 'ban', 'escanor'], two: 'Шкала Предела копится на 25% быстрее.', three: 'Мелиодас и Бан +15% урона, Эсканор +0,3 Солнца.' },
  { id: 'mushoku', name: 'Реинкарнация безработного', heroes: ['rudeus', 'roxy', 'sylphy'], two: 'Заклинания на 15% дешевле.', three: '«Урок» Рокси действует на обоих учеников, Сильфи лечит Рудеуса вдвое.' },
  { id: 'bulls', name: 'Чёрные быки', heroes: ['asta', 'yami'], two: '«Превзойди» на Асту даёт +2 Антимагии; Ями +20% по врагам, с которых Аста снял баффы.' },
  { id: 'frieren', name: 'Отряд Фрирен', heroes: ['stark', 'fern'], two: 'Старк прикрывает Ферн каждый раунд; щит Ферн на Старке +50%.' },
  { id: 'meshi', name: 'Подземелье вкусностей', heroes: ['marcille', 'senshi'], two: 'Брезгливость Марсиль проходит; Сэнши начинает бой с +1 ингредиентом.' },
];

export const CROSS_INFO = [
  { flag: 'aquaAlucard', text: 'Аква + Алукард: её лечение действует на него вдвое слабее, зато он +15% урона назло ей.' },
  { flag: 'escanorKamina', text: 'Эсканор + Камина: клич Камины даёт Эсканору +0,3 Солнца.' },
  { flag: 'hunters', text: 'Гатс + Алукард: +15% урона по демонам и нежити обоим.' },
  { flag: 'cooks', text: 'Санджи + Сэнши: блюда обоих в полтора раза сильнее.' },
];

// ---------- Общие помощники для умений ----------

export function mostWounded(e: Engine, u: Unit, exclude?: Unit): Unit | undefined {
  return e.alliesOf(u).filter((x) => x !== exclude).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
}

export function avgHp(e: Engine, u: Unit): number {
  const l = e.alliesOf(u);
  return l.reduce((s, x) => s + x.hp / x.maxHp, 0) / Math.max(1, l.length);
}

export function isMonster(t: Unit): boolean { return t.tags.includes('monster'); }

export function cookMult(e: Engine): number { return e.team('cooks') ? 1.5 : 1; }
