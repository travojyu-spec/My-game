// Монстры и боссы 12 регионов (по оригиналам).
import { registerKit, type AbilityDef, type Action, type Engine, type HitOpts, type Hooks, type TargetKind, type Unit } from '../battle/core';

export interface Move {
  ab: AbilityDef;
  /** Вес при случайном выборе (0 — только как удар после замаха). */
  w: number;
  when?: (e: Engine, u: Unit) => boolean;
}

export interface EnemyDef {
  key: string; name: string; nameAcc: string; region: number;
  hp: number; atk: number; def: number; spd: number; dodge?: number; crit?: number;
  tags: string[]; resist?: Record<string, number>; boss?: boolean;
  /** Размер заглушки: s 24, m 32, l 44, xl 60 (игровых пикселей). */
  size: 's' | 'm' | 'l' | 'xl';
  sprite?: string; color: string; desc: string;
  moves: Move[];
  hooks?: Hooks;
}

export const ENEMIES: Record<string, EnemyDef> = {};

// ---------- Конструкторы приёмов ----------

type StFn = (e: Engine, u: Unit, t: Unit) => [string, number, number] | null;
const st = (id: string, turns: number, val: number | ((u: Unit, t: Unit) => number) = 1): StFn =>
  (_e, u, t) => [id, turns, typeof val === 'function' ? val(u, t) : val];
const dot = (id: 'burn' | 'bleed' | 'poison', k = 0.3, turns = 3): StFn => (_e, u) => [id, turns, Math.max(1, Math.round(u.atk * k))];

function applySt(e: Engine, u: Unit, t: Unit, fx?: StFn[], chance = 1): void {
  if (!fx || !t.alive) return;
  if (chance < 1 && e.rnd() >= chance) return;
  for (const f of fx) {
    const r = f(e, u, t);
    if (r) e.add(t, r[0], r[1], r[2]);
  }
}

interface MoveOpts extends HitOpts { cd?: number; fx?: StFn[]; chance?: number; desc?: string; target?: TargetKind; icon?: string }

/** Удар по одной цели. */
function strike(id: string, name: string, p: number, o: MoveOpts = {}): AbilityDef {
  const { cd, fx, chance, desc, target, icon, ...h } = o;
  return {
    id, name, label: name, icon: icon ?? 'ui/icons/sword', kind: 'skill', target: target ?? 'enemy', cd, magic: h.magic,
    fx: h.magic ? 'magic' : target === 'enemyAny' ? 'shot' : 'melee', desc: desc ?? '',
    run: (e, u, t) => { const n = e.hit(u, t!, p, h); if (n > 0) applySt(e, u, t!, fx, chance); },
  };
}
/** Несколько ударов по случайным героям. */
function volley(id: string, name: string, n: number, p: number, o: MoveOpts = {}): AbilityDef {
  const { cd, fx, chance, desc, ...h } = o;
  return {
    id, name, label: name, icon: 'ui/icons/sword', kind: 'skill', target: 'allEnemies', cd, magic: h.magic, fx: h.magic ? 'magic' : 'shot', desc: desc ?? '',
    run: (e, u) => { for (const t of e.randFoes(u, n)) { const k = e.hit(u, t, p, { ...h, single: false }); if (k > 0) applySt(e, u, t, fx, chance); } },
  };
}
/** Удар по всем героям. */
function sweep(id: string, name: string, p: number, o: MoveOpts = {}): AbilityDef {
  const { cd, fx, chance, desc, ...h } = o;
  return {
    id, name, label: name, icon: 'ui/icons/fire', kind: 'skill', target: 'allEnemies', cd, magic: h.magic, fx: 'aoe', desc: desc ?? '',
    run: (e, u) => { for (const t of e.foesOf(u)) { const k = e.hit(u, t, p, { ...h, single: false }); if (k > 0) applySt(e, u, t, fx, chance); } },
  };
}
/** Эффект на себя или своих. */
function buff(id: string, name: string, who: 'self' | 'all' | 'weakest', fx: StFn[], o: { cd?: number; heal?: number; desc?: string; magic?: boolean } = {}): AbilityDef {
  return {
    id, name, label: name, icon: 'ui/icons/shield', kind: 'skill', target: 'self', cd: o.cd, magic: o.magic, fx: o.heal ? 'heal' : 'buff', desc: o.desc ?? '',
    run: (e, u) => {
      const l = who === 'self' ? [u] : who === 'all' ? e.alliesOf(u) : [e.alliesOf(u).sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0]];
      for (const x of l) {
        if (o.heal) e.heal(x, x.maxHp * o.heal);
        applySt(e, u, x, fx);
      }
    },
  };
}
/** Негативный эффект на героя (или всех) без урона. */
function curse(id: string, name: string, all: boolean, fx: StFn[], o: { cd?: number; magic?: boolean; desc?: string } = {}): AbilityDef {
  return {
    id, name, label: name, icon: 'ui/icons/fire', kind: 'skill', target: all ? 'allEnemies' : 'enemyAny', cd: o.cd, magic: o.magic ?? true, fx: 'magic', desc: o.desc ?? '',
    run: (e, u, t) => {
      for (const x of all ? e.foesOf(u) : [t!]) {
        if (o.magic !== false && e.has(x, 'absorbMagic')) { e.hit(u, x, 0.5, { magic: true, sure: true }); continue; }
        applySt(e, u, x, fx);
      }
    },
  };
}
/** Призыв подкрепления. */
function summon(id: string, name: string, key: string, max: number, cd = 3): AbilityDef {
  return {
    id, name, label: name, icon: 'ui/icons/shield', kind: 'skill', target: 'self', cd, fx: 'buff', desc: '',
    check: (e, u) => (e.alliesOf(u).filter((x) => x.key === key).length >= max || e.alliesOf(u).length >= 5 ? 'Хватит.' : null),
    run: (e, u) => { spawnHook?.(e, key, u); },
  };
}
/** Замах: в этот ход готовится, в следующий — бьёт приёмом heavy. Сильфи может сбить. */
function windup(id: string, name: string, heavy: string, text: string, cd = 3): AbilityDef {
  return {
    id, name, label: name, icon: 'ui/icons/fire', kind: 'skill', target: 'self', cd, fx: 'buff', desc: text,
    run: (e, u) => { u.res.windupT = 1; u.res.windupA = HEAVY.indexOf(heavy) + 1; e.float(u, text, '#ff6a55'); e.say(`${u.name}: ${text}`); },
  };
}
const HEAVY: string[] = [];

/** Создание врага в бою (задаётся из progress.ts, чтобы не тянуть зависимость). */
export let spawnHook: ((e: Engine, key: string, by: Unit) => void) | null = null;
export function setSpawnHook(f: (e: Engine, key: string, by: Unit) => void): void { spawnHook = f; }

// ---------- ИИ врагов ----------

function chooseTarget(e: Engine, u: Unit, a: AbilityDef): Unit | null {
  const l = e.validTargets(u, a);
  if (!l.length) return null;
  if (a.target === 'ally' || a.target === 'allyWounded') return l.sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0];
  const w = l.map((x) => (e.kit(x).threat ?? 1) * (x.hp < x.maxHp * 0.35 ? 1.4 : 1));
  let r = e.rnd() * w.reduce((s, x) => s + x, 0);
  for (let i = 0; i < l.length; i++) { r -= w[i]; if (r <= 0) return l[i]; }
  return l[l.length - 1];
}

function decideEnemy(def: EnemyDef) {
  return (e: Engine, u: Unit): Action | null => {
    let a: AbilityDef | undefined;
    if (u.res.windupT) {
      const id = HEAVY[u.res.windupA - 1];
      u.res.windupT = 0;
      a = def.moves.find((m) => m.ab.id === id)?.ab;
    }
    if (!a) {
      const l = def.moves.filter((m) => m.w > 0 && !e.check(u, m.ab) && (!m.when || m.when(e, u)));
      if (!l.length) return { uid: u.uid, ab: 'pass', tgt: null };
      let r = e.rnd() * l.reduce((s, m) => s + m.w, 0);
      a = l[l.length - 1].ab;
      for (const m of l) { r -= m.w; if (r <= 0) { a = m.ab; break; } }
    }
    const t = e.needsTarget(a) ? chooseTarget(e, u, a) : null;
    if (e.needsTarget(a) && !t) {
      const b = def.moves[0].ab;
      const t2 = chooseTarget(e, u, b);
      return t2 ? { uid: u.uid, ab: b.id, tgt: t2.uid } : { uid: u.uid, ab: 'pass', tgt: null };
    }
    return { uid: u.uid, ab: a.id, tgt: t?.uid ?? null };
  };
}

function enemy(d: EnemyDef): void {
  for (const m of d.moves) if (m.w === 0 && !HEAVY.includes(m.ab.id)) HEAVY.push(m.ab.id);
  ENEMIES[d.key] = d;
  registerKit({ key: d.key, abilities: () => d.moves.map((m) => m.ab), hooks: d.hooks ?? {}, decide: decideEnemy(d) });
}

const hpBelow = (k: number) => (_e: Engine, u: Unit) => u.hp < u.maxHp * k;
const once = (flag: string, k: number) => (_e: Engine, u: Unit) => u.hp < u.maxHp * k && !u.res[flag];
const enrage = (flag: string, k: number, fx: (e: Engine, u: Unit) => void): Hooks['onDamaged'] =>
  (e, u) => { if (!u.res[flag] && u.alive && u.hp < u.maxHp * k) { u.res[flag] = 1; fx(e, u); } };

// =====================================================================
// 1. Аксель — «Коносуба»
// =====================================================================
enemy({
  key: 'toad', name: 'Гигантская жаба', nameAcc: 'гигантскую жабу', region: 1, size: 'l', color: '#7aa860',
  hp: 58, atk: 8, def: 0, spd: 3, tags: ['monster', 'food:frog'], resist: { phys: 0.85, fire: 1.3 },
  desc: 'Тупая, но огромная. Удары оружием вязнут в жире. Может проглотить героя.',
  moves: [
    { ab: strike('t_tongue', 'Удар языком', 1.0), w: 3 },
    { ab: strike('t_swallow', 'Проглотить', 0.6, { cd: 3, fx: [st('stun', 1)], desc: 'Проглоченный герой пропускает ход.' }), w: 2 },
  ],
});
enemy({
  key: 'cabbage', name: 'Летающая капуста', nameAcc: 'летающую капусту', region: 1, size: 's', color: '#9fd36b',
  hp: 18, atk: 6, def: 0, spd: 12, dodge: 0.2, tags: ['monster', 'food:cabbage'],
  desc: 'Капуста урожая этого года. Быстрая и вёрткая.',
  moves: [
    { ab: strike('c_ram', 'Таран', 1.0), w: 3 },
    { ab: volley('c_swarm', 'Налёт', 2, 0.55), w: 2 },
  ],
});
enemy({
  key: 'goblin', name: 'Гоблин', nameAcc: 'гоблина', region: 1, size: 'm', color: '#6f8f3a', sprite: 'enemies/goblin',
  hp: 30, atk: 7, def: 0.05, spd: 6, tags: ['goblin'],
  desc: 'Подлый, трусливый, нападает толпой.',
  moves: [
    { ab: strike('g_club', 'Дубина', 1.0), w: 3 },
    { ab: strike('g_rock', 'Камень', 0.8, { target: 'enemyAny' }), w: 2 },
    { ab: buff('g_mob', 'Толпой!', 'all', [st('atkUp', 2, 15)], { cd: 3 }), w: 1, when: (e, u) => e.alliesOf(u).filter((x) => x.tags.includes('goblin')).length >= 3 },
  ],
});
enemy({
  key: 'goblin_shaman', name: 'Гоблин-шаман', nameAcc: 'гоблина-шамана', region: 1, size: 'm', color: '#5a6f9a',
  hp: 26, atk: 8, def: 0, spd: 5, tags: ['goblin', 'mage'],
  desc: 'Колдует огненные стрелы и лечит сородичей.',
  moves: [
    { ab: strike('gs_fire', 'Огненная стрела', 1.2, { magic: true, type: 'fire', target: 'enemyAny' }), w: 3 },
    { ab: buff('gs_heal', 'Лечение сородичей', 'weakest', [], { heal: 0.25, cd: 2, magic: true }), w: 3, when: (e, u) => e.alliesOf(u).some((x) => x.hp < x.maxHp * 0.6) },
  ],
});
enemy({
  key: 'undead_knight', name: 'Рыцарь-нежить', nameAcc: 'рыцаря-нежить', region: 1, size: 'm', color: '#6d6f7d',
  hp: 60, atk: 9, def: 0.25, spd: 4, tags: ['undead'], resist: { holy: 2, water: 1.3 },
  desc: 'Солдат Бельдии. Святая сила и вода для него губительны.',
  moves: [
    { ab: strike('uk_sword', 'Ржавый меч', 1.1), w: 3 },
    { ab: buff('uk_line', 'Сомкнуть строй', 'self', [st('defUp', 2, 30)], { cd: 3 }), w: 1 },
  ],
});
enemy({
  key: 'beldia', name: 'Бельдия', nameAcc: 'Бельдию', region: 1, boss: true, size: 'xl', color: '#3a3f55',
  hp: 430, atk: 14, def: 0.3, spd: 5, tags: ['undead', 'demon'], resist: { holy: 2, water: 1.5 },
  desc: 'Дуллахан, генерал Короля демонов. Проклятие смерти убивает через 3 хода — снимите его очищением.',
  moves: [
    { ab: strike('be_sword', 'Двуручный меч', 1.4), w: 4 },
    { ab: curse('be_doom', 'Проклятие смерти', false, [st('doom', 3, (_u, t) => Math.round(t.maxHp * 0.8))], { cd: 4, desc: 'Через 3 хода цель получит огромный урон.' }), w: 3 },
    { ab: summon('be_call', 'Ко мне, рыцари!', 'undead_knight', 2, 4), w: 2 },
    { ab: windup('be_jump', 'Голову — в небо', 'be_leap', 'подбросил голову и видит всё поле!', 4), w: 2, when: hpBelow(0.7) },
    { ab: sweep('be_leap', 'Удар сверху', 2.0, { sure: true }), w: 0 },
  ],
});

// =====================================================================
// 2. Подземелье — «Подземелье вкусностей»
// =====================================================================
enemy({
  key: 'living_armor', name: 'Живые доспехи', nameAcc: 'живые доспехи', region: 2, size: 'm', color: '#8b8f99', sprite: 'enemies/brute',
  hp: 62, atk: 10, def: 0.4, spd: 3, tags: ['monster', 'construct', 'food:shell'], resist: { lightning: 1.3 },
  desc: 'Внутри — колония моллюсков. Броня крепкая, но молния бьёт насквозь.',
  moves: [
    { ab: strike('la_sword', 'Взмах мечом', 1.2), w: 3 },
    { ab: buff('la_guard', 'Стойка', 'self', [st('defUp', 2, 30)], { cd: 3 }), w: 1 },
  ],
});
enemy({
  key: 'walking_mushroom', name: 'Ходячий гриб', nameAcc: 'ходячий гриб', region: 2, size: 's', color: '#c8a070', sprite: 'enemies/sprout',
  hp: 34, atk: 8, def: 0, spd: 5, tags: ['monster', 'food:mushroom'], resist: { fire: 1.4 },
  desc: 'Пинается и пускает ядовитые споры.',
  moves: [
    { ab: strike('wm_kick', 'Пинок', 1.0), w: 2 },
    { ab: sweep('wm_spores', 'Споры', 0.4, { fx: [dot('poison', 0.3)], cd: 3 }), w: 2 },
  ],
});
enemy({
  key: 'mandrake', name: 'Мандрагора', nameAcc: 'мандрагору', region: 2, size: 's', color: '#b5a050',
  hp: 30, atk: 7, def: 0, spd: 4, tags: ['monster', 'food:mandrake'],
  desc: 'Её крик пугает и оглушает.',
  moves: [
    { ab: strike('md_root', 'Удар корнем', 0.9), w: 2 },
    { ab: sweep('md_scream', 'Вопль', 0.5, { magic: true, fx: [st('fear', 2, 15)], cd: 3 }), w: 2 },
  ],
});
enemy({
  key: 'slime', name: 'Слизень', nameAcc: 'слизня', region: 2, size: 'm', color: '#6fc2c9',
  hp: 46, atk: 8, def: 0, spd: 3, tags: ['monster', 'food:slime'], resist: { phys: 0.6, fire: 1.5 },
  desc: 'Удары оружием вязнут. Огонь — лучший рецепт.',
  moves: [
    { ab: strike('sl_wrap', 'Обволакивание', 0.9, { fx: [st('slow', 2, 30)] }), w: 3 },
    { ab: strike('sl_choke', 'Удушье', 1.3, { cd: 2 }), w: 2 },
  ],
});
enemy({
  key: 'basilisk', name: 'Василиск', nameAcc: 'василиска', region: 2, size: 'l', color: '#b0703a',
  hp: 72, atk: 11, def: 0.1, spd: 5, tags: ['monster', 'food:basilisk'],
  desc: 'Петух спереди, змея сзади. Хвост ядовит.',
  moves: [
    { ab: strike('ba_peck', 'Клюв', 1.2), w: 3 },
    { ab: strike('ba_tail', 'Ядовитый хвост', 0.8, { fx: [dot('poison', 0.35)], cd: 2 }), w: 2 },
  ],
});
enemy({
  key: 'red_dragon', name: 'Красный дракон', nameAcc: 'Красного дракона', region: 2, boss: true, size: 'xl', color: '#c0392b',
  hp: 520, atk: 16, def: 0.3, spd: 4, tags: ['monster', 'dragon', 'food:meat'], resist: { fire: 0.3, ice: 1.3 },
  desc: 'Перед огненным дыханием набирает воздух — время ставить щиты или сбить замах.',
  moves: [
    { ab: strike('rd_bite', 'Укус', 1.6), w: 3 },
    { ab: sweep('rd_tail', 'Удар хвостом', 0.8), w: 2 },
    { ab: windup('rd_inhale', 'Вдох', 'rd_breath', 'набирает воздух…', 3), w: 2 },
    { ab: sweep('rd_breath', 'Огненное дыхание', 1.8, { type: 'fire', fx: [dot('burn', 0.3)] }), w: 0 },
  ],
  hooks: { onDamaged: enrage('enr', 0.5, (e, u) => { e.add(u, 'atkUp', 99, 30); e.say('Красный дракон в ярости!'); }) },
});

// =====================================================================
// 3. Клевер — «Чёрный клевер»
// =====================================================================
enemy({
  key: 'midnight_mage', name: 'Маг Полуночного солнца', nameAcc: 'мага Полуночного солнца', region: 3, size: 'm', color: '#4b3f8f',
  hp: 40, atk: 10, def: 0.05, spd: 6, tags: ['mage'],
  desc: 'Боевой маг культа. Огонь, ветер и барьеры.',
  moves: [
    { ab: strike('mm_fire', 'Огненный шар', 1.2, { magic: true, type: 'fire', target: 'enemyAny' }), w: 3 },
    { ab: volley('mm_wind', 'Ветряные клинки', 3, 0.5, { magic: true, type: 'wind' }), w: 2 },
    { ab: buff('mm_barrier', 'Барьер', 'weakest', [(_e, u) => ['shield', 99, Math.round(u.atk * 2)]], { cd: 3, magic: true }), w: 1 },
  ],
});
enemy({
  key: 'elf', name: 'Воплощённый эльф', nameAcc: 'воплощённого эльфа', region: 3, size: 'm', color: '#7fbf7f',
  hp: 55, atk: 11, def: 0.1, spd: 7, tags: ['mage'],
  desc: 'Древний эльф в чужом теле. Бьёт магией по всем.',
  moves: [
    { ab: strike('el_arrow', 'Магическая стрела', 1.2, { magic: true }), w: 2 },
    { ab: sweep('el_storm', 'Буря маны', 0.7, { magic: true, cd: 2 }), w: 2 },
  ],
});
enemy({
  key: 'low_demon', name: 'Низший демон', nameAcc: 'низшего демона', region: 3, size: 'l', color: '#3b1f2b',
  hp: 64, atk: 11, def: 0.15, spd: 5, tags: ['demon'], resist: { holy: 1.5 },
  desc: 'Призванный из преисподней. Проклятия ослабляют героев.',
  moves: [
    { ab: strike('ld_claw', 'Тёмный коготь', 1.2, { type: 'dark' }), w: 3 },
    { ab: curse('ld_curse', 'Проклятие', false, [st('atkDown', 2, 20)], { cd: 3 }), w: 1 },
  ],
});
enemy({
  key: 'dante', name: 'Данте Зогратис', nameAcc: 'Данте Зогратиса', region: 3, boss: true, size: 'xl', color: '#5e2a2a',
  hp: 560, atk: 15, def: 0.25, spd: 6, tags: ['mage', 'demon'],
  desc: 'Тёмная триада. Магия тела: регенерация 4% в ход. Аста снимает её своим мечом.',
  moves: [
    { ab: strike('da_crush', 'Сокрушение', 1.5), w: 3 },
    { ab: sweep('da_grav', 'Гравитация', 1.0, { magic: true, type: 'dark', fx: [st('slow', 2, 30)], cd: 2 }), w: 2 },
    { ab: buff('da_flesh', 'Перестройка тела', 'self', [st('regen', 99, 4)], { cd: 4 }), w: 2, when: (e, u) => !e.has(u, 'regen') },
    { ab: windup('da_charge', 'Тело демона', 'da_smash', 'тело раздувается для удара!', 4), w: 1, when: hpBelow(0.6) },
    { ab: strike('da_smash', 'Удар демонического тела', 3.0, { sure: true }), w: 0 },
  ],
  hooks: {
    battleStart: (e, u) => { e.add(u, 'regen', 99, 4); },
    onDamaged: enrage('enr', 0.5, (e, u) => { e.add(u, 'atkUp', 99, 25); e.say('Данте: «Тьма лишь растёт!»'); }),
  },
});

// =====================================================================
// 4. Северные земли — «Провожающая в последний путь Фрирен»
// =====================================================================
enemy({
  key: 'demon_mage', name: 'Демон', nameAcc: 'демона', region: 4, size: 'm', color: '#6b2a4a',
  hp: 50, atk: 11, def: 0.1, spd: 6, tags: ['demon', 'mage'], resist: { holy: 1.5 },
  desc: 'Говорит как человек, чтобы обмануть. Знает Зольтраак.',
  moves: [
    { ab: strike('dm_zolt', 'Зольтраак', 1.3, { magic: true, target: 'enemyAny' }), w: 3 },
    { ab: curse('dm_words', 'Сладкие речи', false, [st('atkDown', 2, 20)], { cd: 3, magic: false }), w: 1 },
  ],
});
enemy({
  key: 'mimic', name: 'Мимик', nameAcc: 'мимика', region: 4, size: 'm', color: '#a0703c',
  hp: 72, atk: 12, def: 0.3, spd: 4, tags: ['monster', 'food:meat'],
  desc: 'Выглядит как сундук. Кусается очень больно.',
  moves: [
    { ab: strike('mi_bite', 'Укус', 1.5, { fx: [dot('bleed', 0.3)] }), w: 3 },
    { ab: buff('mi_lid', 'Захлопнуться', 'self', [st('defUp', 2, 40)], { cd: 3 }), w: 1 },
  ],
});
enemy({
  key: 'headless', name: 'Безголовый солдат', nameAcc: 'безголового солдата', region: 4, size: 'm', color: '#5f5f6f',
  hp: 46, atk: 10, def: 0.2, spd: 4, tags: ['undead'], resist: { holy: 2 },
  desc: 'Подчинённый Ауры. Не чувствует боли.',
  moves: [{ ab: strike('hs_sword', 'Меч', 1.1), w: 1 }],
});
enemy({
  key: 'aura', name: 'Аура Гильотина', nameAcc: 'Ауру Гильотину', region: 4, boss: true, size: 'xl', color: '#d68bb5',
  hp: 600, atk: 15, def: 0.2, spd: 6, tags: ['demon', 'mage', 'female'], resist: { holy: 1.5 },
  desc: 'Весы подчинения делают героя марионеткой на 2 хода. Ферн не поддаётся.',
  moves: [
    { ab: strike('au_magic', 'Тёмный снаряд', 1.3, { magic: true, type: 'dark', target: 'enemyAny' }), w: 3 },
    { ab: curse('au_scales', 'Весы подчинения', false, [st('charm', 2)], { cd: 4, desc: 'Цель 2 хода бьёт своих.' }), w: 3 },
    { ab: summon('au_army', 'Армия мёртвых', 'headless', 3, 3), w: 2 },
    { ab: sweep('au_wave', 'Волна маны', 0.9, { magic: true, cd: 2 }), w: 1, when: hpBelow(0.5) },
  ],
});

// =====================================================================
// 5. Британия — «Семь смертных грехов»
// =====================================================================
enemy({
  key: 'red_demon', name: 'Красный демон', nameAcc: 'красного демона', region: 5, size: 'l', color: '#b03030',
  hp: 72, atk: 12, def: 0.15, spd: 4, tags: ['demon'], resist: { holy: 1.5, fire: 0.5 },
  desc: 'Огромный, дышит пламенем, быстро заживает.',
  moves: [
    { ab: strike('rde_claw', 'Когти', 1.3), w: 3 },
    { ab: sweep('rde_flame', 'Пламя', 0.7, { type: 'fire', cd: 3 }), w: 2 },
  ],
  hooks: { turnStart: (e, u) => { e.heal(u, u.maxHp * 0.04, true); } },
});
enemy({
  key: 'grey_demon', name: 'Серый демон', nameAcc: 'серого демона', region: 5, size: 'l', color: '#707070',
  hp: 80, atk: 13, def: 0.15, spd: 5, tags: ['demon', 'mage'], resist: { holy: 1.5 },
  desc: 'Тёмная магия и сковывание.',
  moves: [
    { ab: strike('gde_bolt', 'Тёмный снаряд', 1.3, { magic: true, type: 'dark', target: 'enemyAny' }), w: 3 },
    { ab: curse('gde_bind', 'Сковывание', false, [st('silence', 2), st('slow', 2, 30)], { cd: 3 }), w: 1 },
  ],
});
enemy({
  key: 'holy_knight', name: 'Святой рыцарь', nameAcc: 'святого рыцаря', region: 5, size: 'm', color: '#d0d4e0',
  hp: 58, atk: 12, def: 0.3, spd: 6, tags: ['human'],
  desc: 'Рыцарь королевства под властью демонов.',
  moves: [
    { ab: strike('hk_sword', 'Меч', 1.2), w: 3 },
    { ab: strike('hk_holy', 'Святая магия', 1.3, { magic: true, type: 'holy', cd: 2 }), w: 2 },
  ],
});
enemy({
  key: 'estarossa', name: 'Эстаросса', nameAcc: 'Эстароссу', region: 5, boss: true, size: 'xl', color: '#222034',
  hp: 680, atk: 17, def: 0.3, spd: 6, tags: ['demon'], resist: { holy: 1.3 },
  desc: 'Полный контрудар: после стойки отражает заклинания. Заповедь любви пугает тех, кто бьёт сильнее всех.',
  moves: [
    { ab: volley('es_blades', 'Тёмные клинки', 4, 0.6, { type: 'dark' }), w: 3 },
    { ab: strike('es_strike', 'Удар', 1.5), w: 2 },
    { ab: buff('es_counter', 'Полный контрудар', 'self', [st('reflectMagic', 2, 1.5)], { cd: 3, desc: 'Отражает заклинания.' }), w: 2 },
    { ab: curse('es_love', 'Заповедь любви', true, [st('fear', 2, 25)], { cd: 4 }), w: 1 },
  ],
  hooks: { onDamaged: enrage('enr', 0.5, (e, u) => { e.add(u, 'atkUp', 99, 30); e.add(u, 'haste', 99, 30); e.say('Эстаросса пробуждает силу демона!'); }) },
});

// =====================================================================
// 6. Шангри-Ла — «Шангри-Ла Фронтир»
// =====================================================================
enemy({
  key: 'skeleton', name: 'Скелет-воин', nameAcc: 'скелета-воина', region: 6, size: 'm', color: '#d8d0b8',
  hp: 60, atk: 12, def: 0.2, spd: 6, tags: ['undead'], resist: { holy: 2 },
  desc: 'Страж древней гробницы.',
  moves: [
    { ab: strike('sk_sword', 'Ржавый клинок', 1.2), w: 3 },
    { ab: strike('sk_shield', 'Удар щитом', 0.8, { fx: [st('stun', 1)], chance: 0.4, cd: 3 }), w: 1 },
  ],
});
enemy({
  key: 'tomb_spirit', name: 'Дух гробницы', nameAcc: 'духа гробницы', region: 6, size: 's', color: '#9fb8d8',
  hp: 40, atk: 12, def: 0, spd: 8, dodge: 0.25, tags: ['spirit', 'undead'], resist: { phys: 0.6, holy: 2 },
  desc: 'Призрак. Оружие проходит сквозь него.',
  moves: [
    { ab: strike('ts_touch', 'Ледяное касание', 1.2, { magic: true, type: 'ice', fx: [st('slow', 2, 25)] }), w: 1 },
  ],
});
enemy({
  key: 'night_wolf', name: 'Ночной волк', nameAcc: 'ночного волка', region: 6, size: 'm', color: '#2f3550',
  hp: 55, atk: 13, def: 0.1, spd: 10, tags: ['monster', 'beast', 'food:meat'],
  desc: 'Быстрый хищник. Бьёт по раненым.',
  moves: [
    { ab: strike('nw_bite', 'Укус', 1.2, { fx: [dot('bleed', 0.3)] }), w: 1 },
  ],
});
enemy({
  key: 'weathermon', name: 'Страж гробницы Везермон', nameAcc: 'Везермона', region: 6, boss: true, size: 'xl', color: '#c0c8d8',
  hp: 760, atk: 18, def: 0.35, spd: 7, tags: ['undead'], resist: { holy: 1.6 },
  desc: 'Уникальный монстр-рыцарь. Каждые несколько ходов замахивается для разреза по всем.',
  moves: [
    { ab: strike('we_sword', 'Удар меча', 1.6), w: 3 },
    { ab: volley('we_dance', 'Танец клинков', 4, 0.6), w: 2 },
    { ab: windup('we_stance', 'Стойка', 'we_cut', 'поднимает меч к небу…', 3), w: 2 },
    { ab: sweep('we_cut', 'Небесный разрез', 2.0, { sure: true }), w: 0 },
  ],
  hooks: { onDamaged: enrage('enr', 0.5, (e, u) => { e.add(u, 'atkUp', 99, 50); e.say('Везермон: «Последняя стойка!»'); }) },
});

// =====================================================================
// 7. Демонический континент — «Реинкарнация безработного»
// =====================================================================
enemy({
  key: 'acid_wolf', name: 'Кислотный волк', nameAcc: 'кислотного волка', region: 7, size: 'm', color: '#8fbf3a',
  hp: 56, atk: 12, def: 0.1, spd: 9, tags: ['monster', 'beast', 'food:meat'],
  desc: 'Стая. Слюна разъедает броню.',
  moves: [
    { ab: strike('aw_bite', 'Кислотный укус', 1.1, { fx: [dot('poison', 0.35), st('vuln', 2, 15)] }), w: 1 },
  ],
});
enemy({
  key: 'great_tortoise', name: 'Великая черепаха', nameAcc: 'великую черепаху', region: 7, size: 'l', color: '#5f7a4a',
  hp: 110, atk: 10, def: 0.5, spd: 2, tags: ['monster', 'food:shell'], resist: { lightning: 1.4 },
  desc: 'Панцирь почти непробиваем. Вкусная.',
  moves: [
    { ab: strike('gt_bite', 'Укус', 1.3), w: 2 },
    { ab: buff('gt_shell', 'В панцирь', 'self', [(_e, u) => ['shield', 99, Math.round(u.maxHp * 0.2)]], { cd: 3 }), w: 1 },
  ],
});
enemy({
  key: 'demon_snake', name: 'Демоническая змея', nameAcc: 'демоническую змею', region: 7, size: 'm', color: '#4a2a6a',
  hp: 50, atk: 13, def: 0.1, spd: 7, tags: ['monster', 'food:basilisk'],
  desc: 'Ядовитая, атакует любого в отряде.',
  moves: [
    { ab: strike('ds_fang', 'Ядовитый клык', 1.0, { target: 'enemyAny', fx: [dot('poison', 0.4)] }), w: 1 },
  ],
});
enemy({
  key: 'orsted', name: 'Орстед', nameAcc: 'Орстеда', region: 7, boss: true, size: 'xl', color: '#c0c0c0',
  hp: 840, atk: 20, def: 0.35, spd: 9, tags: ['human', 'mage'],
  desc: 'Бог-Дракон. Проклятие внушает страх. Каждые 3 хода снимает с отряда все усиления.',
  moves: [
    { ab: strike('or_strike', 'Удар Бога-Дракона', 1.8), w: 3 },
    { ab: curse('or_cancel', 'Отмена магии', true, [], { cd: 3, magic: false }), w: 2 },
    { ab: sweep('or_roar', 'Рёв', 1.0, { fx: [st('fear', 2, 20)], cd: 3 }), w: 1 },
    { ab: windup('or_gather', 'Сбор маны', 'or_light', 'собирает ману в ладони…', 4), w: 1 },
    { ab: strike('or_light', 'Свет Бога-Дракона', 3.0, { magic: true, sure: true, target: 'enemyAny' }), w: 0 },
  ],
  hooks: {
    battleStart: (e, u) => { for (const h of e.foesOf(u)) e.add(h, 'fear', 2, 20); e.say('Проклятие Орстеда: героям страшно.'); },
    onAfterAction: (e, u, ab) => { if (ab.id === 'or_cancel') { for (const h of e.foesOf(u)) e.dispel(h, 99); e.say('Орстед развеял все усиления.'); } },
  },
});

// =====================================================================
// 8. Гранд Лайн — «Ван-Пис»
// =====================================================================
enemy({
  key: 'pirate', name: 'Пират', nameAcc: 'пирата', region: 8, size: 'm', color: '#8a5a3a',
  hp: 52, atk: 12, def: 0.1, spd: 6, tags: ['human'],
  desc: 'Абордажная сабля и пистолет.',
  moves: [
    { ab: strike('pi_cut', 'Сабля', 1.1), w: 3 },
    { ab: strike('pi_shot', 'Пистолет', 1.0, { target: 'enemyAny' }), w: 2 },
  ],
});
enemy({
  key: 'marine', name: 'Морской пехотинец', nameAcc: 'морского пехотинца', region: 8, size: 'm', color: '#3d6fa8',
  hp: 60, atk: 12, def: 0.3, spd: 5, tags: ['human'],
  desc: 'Дисциплина и строй.',
  moves: [
    { ab: strike('ma_rifle', 'Винтовка', 1.1, { target: 'enemyAny' }), w: 3 },
    { ab: buff('ma_form', 'Строй!', 'all', [st('defUp', 2, 20)], { cd: 3 }), w: 1 },
  ],
});
enemy({
  key: 'sea_king', name: 'Морской король', nameAcc: 'морского короля', region: 8, size: 'xl', color: '#3a8a8a',
  hp: 160, atk: 16, def: 0.2, spd: 4, tags: ['monster', 'food:meat'], resist: { water: 0.3, lightning: 1.3 },
  desc: 'Гигантский морской зверь.',
  moves: [
    { ab: strike('sk_bite', 'Укус', 1.6), w: 3 },
    { ab: sweep('sk_wave', 'Волна', 0.9, { type: 'water', fx: [st('wet', 2)], cd: 2 }), w: 2 },
  ],
});
enemy({
  key: 'crocodile', name: 'Сэр Крокодайл', nameAcc: 'Крокодайла', region: 8, boss: true, size: 'xl', color: '#c8a050',
  hp: 900, atk: 21, def: 0.2, spd: 7, tags: ['human', 'logia'],
  desc: 'Логия песка: оружие проходит насквозь (×0,25), пока он не мокрый. Вода Рокси и хаки Луффи помогут.',
  moves: [
    { ab: sweep('cr_spada', 'Десерт Спада', 1.0), w: 3 },
    { ab: strike('cr_hook', 'Ядовитый крюк', 1.4, { fx: [dot('poison', 0.5)] }), w: 2 },
    { ab: strike('cr_dry', 'Иссушение', 1.3, { lifesteal: 0.6, cd: 2 }), w: 2 },
    { ab: windup('cr_sables', 'Сабулс', 'cr_storm', 'поднимает песчаную бурю…', 4), w: 1 },
    { ab: sweep('cr_storm', 'Песчаная буря', 1.6, { fx: [st('accDown', 2, 25)] }), w: 0 },
  ],
  hooks: { turnStart: (e, u) => { if (e.has(u, 'wet') && e.rnd() < 0.4) { e.del(u, 'wet'); e.float(u, 'высох', '#c8a050'); } } },
});

// =====================================================================
// 9. Аместрис — «Стальной алхимик»
// =====================================================================
enemy({
  key: 'chimera', name: 'Химера', nameAcc: 'химеру', region: 9, size: 'l', color: '#7a6040',
  hp: 72, atk: 14, def: 0.15, spd: 7, tags: ['monster', 'food:meat'],
  desc: 'Сшита алхимией из нескольких зверей.',
  moves: [
    { ab: strike('ch_claw', 'Когти', 1.2, { fx: [dot('bleed', 0.3)] }), w: 3 },
    { ab: volley('ch_frenzy', 'Бешенство', 3, 0.6), w: 1 },
  ],
});
enemy({
  key: 'mannequin', name: 'Солдат-манекен', nameAcc: 'солдата-манекена', region: 9, size: 'm', color: '#d8c8b0',
  hp: 62, atk: 13, def: 0.1, spd: 6, tags: ['construct', 'undead'], resist: { holy: 1.5 },
  desc: 'Пустое тело с душой из камня. Вцепляется зубами.',
  moves: [{ ab: strike('mq_bite', 'Укус', 1.3, { lifesteal: 0.3 }), w: 1 }],
});
enemy({
  key: 'gluttony', name: 'Обжорство', nameAcc: 'Обжорство', region: 9, size: 'xl', color: '#c8b0c0',
  hp: 220, atk: 16, def: 0.1, spd: 4, tags: ['homunculus'],
  desc: 'Гомункул. Пожирает всё и лечится.',
  moves: [
    { ab: strike('gl_eat', 'Пожирание', 1.5, { lifesteal: 0.8 }), w: 3 },
    { ab: windup('gl_open', 'Раскрыть пасть', 'gl_void', 'раскрывает живот…', 4), w: 1 },
    { ab: sweep('gl_void', 'Ложные Врата', 1.5, { type: 'dark' }), w: 0 },
  ],
  hooks: { turnStart: (e, u) => { e.heal(u, u.maxHp * 0.05, true); } },
});
enemy({
  key: 'lust', name: 'Похоть', nameAcc: 'Похоть', region: 9, boss: true, size: 'xl', color: '#3a1f3a',
  hp: 800, atk: 22, def: 0.2, spd: 8, tags: ['homunculus', 'female'],
  desc: 'Предельное копьё пробивает любую броню. Философский камень возвращает её к жизни дважды (Аста может снять).',
  moves: [
    { ab: volley('lu_spear', 'Предельное копьё', 2, 1.0, { pierce: 1 }), w: 3 },
    { ab: strike('lu_pierce', 'Пронзить', 1.6, { pierce: 1, fx: [dot('bleed', 0.4)] }), w: 2 },
    { ab: sweep('lu_fan', 'Веер когтей', 0.9, { pierce: 1, cd: 2 }), w: 1 },
  ],
  hooks: {
    battleStart: (e, u) => { e.add(u, 'undying', 99, 2); },
    onFatal: (e, u) => {
      const s = e.st(u, 'undying');
      if (!s) return false;
      s.value -= 1;
      if (s.value <= 0) e.del(u, 'undying');
      u.hp = Math.round(u.maxHp * 0.5);
      e.say('Философский камень возвращает Похоть к жизни!');
      return true;
    },
  },
});

// =====================================================================
// 10. Лондон — «Хеллсинг»
// =====================================================================
enemy({
  key: 'ghoul', name: 'Гуль', nameAcc: 'гуля', region: 10, size: 'm', color: '#7a8a6a',
  hp: 46, atk: 12, def: 0.05, spd: 5, tags: ['undead'], resist: { holy: 2 },
  desc: 'Бывший человек. Лезут толпой.',
  moves: [
    { ab: strike('gh_bite', 'Укус', 1.2), w: 3 },
    { ab: summon('gh_call', 'Стон', 'ghoul', 4, 3), w: 1 },
  ],
});
enemy({
  key: 'vamp_soldier', name: 'Солдат-вампир', nameAcc: 'солдата-вампира', region: 10, size: 'm', color: '#5a3030',
  hp: 66, atk: 15, def: 0.15, spd: 7, tags: ['undead', 'vampire'], resist: { holy: 2 },
  desc: 'Боец «Миллениума». Стреляет очередями, быстро заживает.',
  moves: [
    { ab: volley('vs_burst', 'Очередь', 2, 0.6), w: 3 },
    { ab: strike('vs_fang', 'Клыки', 1.2, { lifesteal: 0.5 }), w: 2 },
  ],
  hooks: { turnStart: (e, u) => { e.heal(u, u.maxHp * 0.05, true); } },
});
enemy({
  key: 'rip', name: 'Рип ван Винкль', nameAcc: 'Рип ван Винкль', region: 10, boss: true, size: 'xl', color: '#6a2a4a',
  hp: 1000, atk: 23, def: 0.2, spd: 9, tags: ['undead', 'vampire', 'female'], resist: { holy: 2 },
  desc: 'Вольный стрелок: волшебная пуля гоняется за героями и не промахивается.',
  moves: [
    { ab: volley('ri_bullet', 'Волшебная пуля', 6, 0.5, { sure: true }), w: 3 },
    { ab: strike('ri_shot', 'Выстрел', 1.6, { target: 'enemyAny' }), w: 2 },
    { ab: windup('ri_aim', 'Прицел', 'ri_hunt', 'поёт «Вольного стрелка»…', 4), w: 1 },
    { ab: strike('ri_hunt', 'Последняя пуля', 3.0, { sure: true, target: 'enemyAny', noCover: true }), w: 0 },
  ],
});

// =====================================================================
// 11. Мидланд — «Берсерк»
// =====================================================================
enemy({
  key: 'apostle', name: 'Апостол', nameAcc: 'апостола', region: 11, size: 'l', color: '#6a3a2a',
  hp: 120, atk: 18, def: 0.2, spd: 6, tags: ['demon'], resist: { holy: 1.5 },
  desc: 'Человек, продавший душу. Ниже половины здоровья сбрасывает облик.',
  moves: [
    { ab: strike('ap_claw', 'Когти', 1.3), w: 3 },
    { ab: sweep('ap_rampage', 'Буйство', 0.7, { cd: 2 }), w: 1 },
  ],
  hooks: { onDamaged: enrage('enr', 0.5, (e, u) => { e.add(u, 'atkUp', 99, 40); e.float(u, 'истинный облик!', '#ff4a4a'); }) },
});
enemy({
  key: 'troll', name: 'Тролль', nameAcc: 'тролля', region: 11, size: 'l', color: '#6a7a5a',
  hp: 92, atk: 16, def: 0.15, spd: 4, tags: ['monster', 'food:meat'],
  desc: 'Тупой и жестокий. Бьёт по площади.',
  moves: [
    { ab: strike('tr_club', 'Дубина', 1.4), w: 3 },
    { ab: sweep('tr_stomp', 'Топот', 0.6, { fx: [st('stun', 1)], chance: 0.25, cd: 3 }), w: 1 },
  ],
});
enemy({
  key: 'evil_spirit', name: 'Злой дух', nameAcc: 'злого духа', region: 11, size: 's', color: '#5a5a8a',
  hp: 42, atk: 14, def: 0, spd: 9, dodge: 0.3, tags: ['spirit'], resist: { phys: 0.5, holy: 2 },
  desc: 'Тянется к носителям Клейма. Оружие почти бесполезно.',
  moves: [{ ab: strike('es_drain', 'Высасывание', 1.2, { magic: true, type: 'dark', lifesteal: 0.5 }), w: 1 }],
});
enemy({
  key: 'zodd', name: 'Бессмертный Зодд', nameAcc: 'Зодда', region: 11, boss: true, size: 'xl', color: '#5a2a1a',
  hp: 1150, atk: 25, def: 0.35, spd: 8, tags: ['demon'], resist: { holy: 1.3 },
  desc: 'Апостол-воин. Ниже половины здоровья превращается в зверя: сильнее и быстрее.',
  moves: [
    { ab: strike('zo_horn', 'Рог', 1.7, { fx: [st('stun', 1)], chance: 0.5 }), w: 3 },
    { ab: volley('zo_sword', 'Двойной удар меча', 2, 1.0), w: 3 },
    { ab: windup('zo_crouch', 'Пригнулся', 'zo_charge', 'готовит рывок!', 3), w: 2 },
    { ab: strike('zo_charge', 'Рывок', 3.2, { sure: true }), w: 0 },
  ],
  hooks: { onDamaged: enrage('enr', 0.5, (e, u) => { e.add(u, 'atkUp', 99, 40); e.add(u, 'haste', 99, 30); u.crit += 0.2; e.say('Зодд принимает облик зверя!'); }) },
});

// =====================================================================
// 12. Поверхность — «Гуррен-Лаганн»
// =====================================================================
enemy({
  key: 'gunmen', name: 'Ганмэн', nameAcc: 'ганмэна', region: 12, size: 'l', color: '#7a6a5a',
  hp: 112, atk: 18, def: 0.4, spd: 4, tags: ['construct'], resist: { lightning: 1.3 },
  desc: 'Боевая машина зверолюдей.',
  moves: [
    { ab: strike('gu_punch', 'Удар', 1.3), w: 3 },
    { ab: strike('gu_cannon', 'Пушка', 1.2, { target: 'enemyAny', type: 'fire' }), w: 2 },
  ],
});
enemy({
  key: 'beastman', name: 'Зверолюд', nameAcc: 'зверолюда', region: 12, size: 'm', color: '#8a6a3a',
  hp: 72, atk: 18, def: 0.15, spd: 8, tags: ['human'],
  desc: 'Солдат Лорденома.',
  moves: [
    { ab: strike('bm_spear', 'Копьё', 1.2), w: 3 },
    { ab: buff('bm_roar', 'Боевой клич', 'all', [st('atkUp', 2, 20)], { cd: 4 }), w: 1 },
  ],
});
enemy({
  key: 'thymilph', name: 'Тимильф', nameAcc: 'Тимильфа', region: 12, boss: true, size: 'xl', color: '#5a5a6a',
  hp: 1100, atk: 27, def: 0.4, spd: 5, tags: ['construct'], resist: { lightning: 1.2 },
  desc: 'Генерал на подвижной крепости Дай-Гандзан. Залп главного калибра бьёт по всем.',
  moves: [
    { ab: strike('ty_fist', 'Кулак крепости', 1.6), w: 3 },
    { ab: summon('ty_launch', 'Ганмэны, на выход!', 'gunmen', 2, 4), w: 2 },
    { ab: buff('ty_armor', 'Броня', 'self', [(_e, u) => ['shield', 99, Math.round(u.maxHp * 0.12)]], { cd: 3 }), w: 1 },
    { ab: windup('ty_load', 'Зарядка орудий', 'ty_salvo', 'наводит главный калибр…', 4), w: 2 },
    { ab: sweep('ty_salvo', 'Залп Дай-Гандзана', 2.2, { type: 'fire' }), w: 0 },
  ],
  hooks: { onDamaged: enrage('enr', 0.5, (e, u) => { e.add(u, 'atkUp', 99, 30); e.say('Тимильф: «Я заставлю вас пожалеть!»'); }) },
});

export const ENEMY_LIST = Object.values(ENEMIES);
export { once };
