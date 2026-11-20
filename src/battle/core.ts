// Движок боя. Состояние — простые данные (можно сохранять и клонировать),
// умения и особенности героев — короткие скрипты на общем наборе действий движка.

export type Side = 'hero' | 'enemy';
export type DmgType = 'phys' | 'fire' | 'ice' | 'lightning' | 'earth' | 'water' | 'wind' | 'holy' | 'dark';
export type TargetKind =
  | 'enemy' | 'enemyAny' | 'allEnemies' | 'ally' | 'allyOther' | 'allyWounded' | 'allyDead' | 'allAllies' | 'self';
export type Fx = 'melee' | 'shot' | 'magic' | 'aoe' | 'buff' | 'heal' | 'none';

export interface Status { id: string; turns: number; value: number; data?: Record<string, any> }

export interface Unit {
  uid: string; key: string; side: Side; name: string; nameAcc: string; pos: number; level: number;
  maxHp: number; hp: number; atk: number; def: number; spd: number;
  maxMp: number; mp: number; mpRegen: number; mpName: string;
  dodge: number; crit: number; limit: number; alive: boolean;
  statuses: Status[]; res: Record<string, number>; cd: Record<string, number>; uses: Record<string, number>;
  nodes: string[]; tags: string[]; resist: Record<string, number>; boss: boolean; xp: number; gold: number;
}

export interface BattleState {
  v: 1; round: number; order: string[]; turn: number; extra: string[]; cur: string; units: Unit[];
  seed: number; result: 'ongoing' | 'victory' | 'defeat'; field: Status[]; team: string[];
  items: Record<string, number>; region: number;
}

export interface HitOpts {
  type?: DmgType; magic?: boolean; pierce?: number; ignoreShield?: boolean; ignoreResist?: boolean;
  sure?: boolean; acc?: number; crit?: number; critMult?: number; lifesteal?: number; flat?: boolean;
  single?: boolean; tag?: string; counter?: boolean; reflected?: boolean; execute?: number; haki?: boolean;
  share?: number; noCover?: boolean;
}

export interface Action { uid: string; ab: string; tgt: string | null }

export interface AbilityDef {
  id: string; name: string; label: string; icon: string; kind: 'basic' | 'skill' | 'ult' | 'item';
  target: TargetKind; cost?: number; cd?: number; perBattle?: number; magic?: boolean; fx?: Fx;
  limit?: number; desc: string;
  check?: (e: Engine, u: Unit) => string | null;
  targets?: (e: Engine, u: Unit) => Unit[];
  run: (e: Engine, u: Unit, t: Unit | null) => void;
}

export interface Hooks {
  battleStart?(e: Engine, u: Unit): void;
  roundStart?(e: Engine, u: Unit): void;
  turnStart?(e: Engine, u: Unit): void;
  dealMult?(e: Engine, u: Unit, t: Unit, o: HitOpts): number;
  takenMult?(e: Engine, u: Unit, src: Unit, o: HitOpts): number;
  allyTakenMult?(e: Engine, u: Unit, ally: Unit, src: Unit, o: HitOpts): number;
  onDamaged?(e: Engine, u: Unit, src: Unit, n: number, o: HitOpts): void;
  onDealt?(e: Engine, u: Unit, t: Unit, n: number, o: HitOpts): void;
  onKill?(e: Engine, u: Unit, victim: Unit): void;
  onAnyDeath?(e: Engine, u: Unit, victim: Unit, killer: Unit | null): void;
  onPartyDamaged?(e: Engine, u: Unit, victim: Unit, n: number): void;
  onEnemyAction?(e: Engine, u: Unit, actor: Unit, ab: AbilityDef): void;
  onFatal?(e: Engine, u: Unit): boolean;
  onAllyFatal?(e: Engine, u: Unit, ally: Unit, n: number): boolean;
  onDodge?(e: Engine, u: Unit, attacker: Unit): void;
  onExpire?(e: Engine, u: Unit, st: Status): void;
  onAfterAction?(e: Engine, u: Unit, ab: AbilityDef): void;
  canActWhileSkipped?(e: Engine, u: Unit): boolean;
  resLine?(e: Engine, u: Unit): string;
}

export interface Kit {
  key: string;
  abilities: (e: Engine, u: Unit) => AbilityDef[];
  hooks: Hooks;
  decide?: (e: Engine, u: Unit) => Action | null;
  /** Насколько охотно враги выбирают его целью (Ферн скрывает ману). */
  threat?: number;
}

export type Ev =
  | { k: 'round'; n: number }
  | { k: 'turn'; uid: string }
  | { k: 'skip'; uid: string; why: string }
  | { k: 'use'; uid: string; ab: string; name: string; tgt: string | null; fx: Fx }
  | { k: 'hit'; uid: string; src: string; n: number; type: DmgType; crit: boolean; absorbed: number; mod: 'weak' | 'resist' | 'immune' | null }
  | { k: 'miss'; uid: string; src: string }
  | { k: 'heal'; uid: string; n: number }
  | { k: 'st'; uid: string; id: string; on: boolean }
  | { k: 'float'; uid: string; text: string; color: string }
  | { k: 'cover'; uid: string; ward: string }
  | { k: 'death'; uid: string }
  | { k: 'revive'; uid: string }
  | { k: 'spawn'; uid: string }
  | { k: 'say'; text: string }
  | { k: 'end'; result: 'victory' | 'defeat' };

// ---------- Справочник статусов ----------

export const STATUS: Record<string, { name: string; color: string; good: boolean; skip?: boolean }> = {
  burn: { name: 'Горение', color: '#ff7a2f', good: false },
  bleed: { name: 'Кровотечение', color: '#c4162a', good: false },
  poison: { name: 'Яд', color: '#7bd13a', good: false },
  stun: { name: 'Оглушение', color: '#ffe14d', good: false, skip: true },
  freeze: { name: 'Заморозка', color: '#8fe3ff', good: false, skip: true },
  sleep: { name: 'Сон', color: '#b9a3ff', good: false, skip: true },
  exhausted: { name: 'Без сил', color: '#8a8a8a', good: false, skip: true },
  slow: { name: 'Замедление', color: '#5a7bd6', good: false },
  fear: { name: 'Страх', color: '#7d3fa8', good: false },
  silence: { name: 'Тишина', color: '#b0b0c8', good: false },
  atkDown: { name: 'Ослабление', color: '#a05030', good: false },
  vuln: { name: 'Уязвимость', color: '#ff4f9a', good: false },
  accDown: { name: 'Слепота', color: '#4b4b4b', good: false },
  wet: { name: 'Мокрый', color: '#3b8cff', good: false },
  doom: { name: 'Проклятие смерти', color: '#4a0d5c', good: false },
  charm: { name: 'Подчинение', color: '#ff8ad8', good: false },
  mark: { name: 'Метка Алого демона', color: '#ff2b2b', good: false },
  mud: { name: 'Трясина', color: '#7a5a2a', good: false },
  shield: { name: 'Щит', color: '#cfe8ff', good: true },
  taunt: { name: 'Провокация', color: '#ff5a3c', good: true },
  atkUp: { name: 'Сила', color: '#ff9f1c', good: true },
  defUp: { name: 'Защита', color: '#4fc3f7', good: true },
  haste: { name: 'Ускорение', color: '#7fffd4', good: true },
  regen: { name: 'Регенерация', color: '#58d68d', good: true },
  dodgeUp: { name: 'Уклонение', color: '#e0ffe0', good: true },
  deathless: { name: 'Не падает', color: '#fff3a0', good: true },
  reflectMagic: { name: 'Полный контрудар', color: '#ffd23f', good: true },
  absorbMagic: { name: 'Поглощение магии', color: '#2b2b2b', good: true },
  counter: { name: 'Контратака', color: '#ffb36b', good: true },
  evadeNext: { name: 'Идеальное уклонение', color: '#d6fff6', good: true },
  invisible: { name: 'Невидимость', color: '#e8e8ff', good: true },
  guarding: { name: 'Прикрывает', color: '#c0c0c0', good: true },
  block: { name: 'Блок', color: '#d9b26f', good: true },
  undying: { name: 'Бессмертие', color: '#9b111e', good: true },
  // Режимы и особые состояния героев
  berserk: { name: 'Доспех берсерка', color: '#5b1010', good: true },
  blackForm: { name: 'Чёрная форма', color: '#1a1a1a', good: true },
  gear2: { name: 'Гир 2', color: '#ff7b7b', good: true },
  gear3: { name: 'Гир 3', color: '#ffb0b0', good: true },
  gear4: { name: 'Гир 4', color: '#a52a2a', good: true },
  gear5: { name: 'Гир 5', color: '#ffffff', good: true },
  magicArmor: { name: 'Магическая броня', color: '#8b8b8b', good: true },
  assault: { name: 'Режим ярости', color: '#300030', good: true },
  clones: { name: 'Копии Лоствейна', color: '#e6c84f', good: true },
  souls: { name: 'Армия душ', color: '#7a0000', good: true },
  hound: { name: 'Баскервиль', color: '#300000', good: true },
  fed: { name: 'Сытость', color: '#f5deb3', good: true },
  lesson: { name: 'Урок', color: '#3d9ad1', good: true },
  limitBreak: { name: 'Превзойти пределы', color: '#202020', good: true },
  focus: { name: 'Концентрация', color: '#ffffff', good: true },
  rising: { name: 'Встанет', color: '#9b111e', good: true },
  stunGuard: { name: 'Устойчивость', color: '#aaaaaa', good: true },
};

const SKIP = ['stun', 'freeze', 'sleep', 'exhausted'];
const CONTROL = ['stun', 'freeze', 'sleep'];

// ---------- Реестр ----------

const kits = new Map<string, Kit>();
export function registerKit(k: Kit): void { kits.set(k.key, k); }
export function kitOf(key: string): Kit {
  const k = kits.get(key);
  if (!k) throw new Error('Нет описания бойца ' + key);
  return k;
}

export const pct = (n: number) => Math.round(n * 100);

// ---------- Движок ----------

export class Engine {
  s: BattleState;
  ev: Ev[] = [];
  preview = false;
  private dealt = false;

  constructor(s: BattleState) { this.s = s; }

  // --- случайность (mulberry32, состояние в s.seed) ---
  rnd(): number {
    if (this.preview) return 0.5;
    let t = (this.s.seed = (this.s.seed + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  pick<T>(l: T[]): T { return l[Math.floor(this.rnd() * l.length) % l.length]; }

  // --- доступ ---
  u(uid: string): Unit { return this.s.units.find((x) => x.uid === uid)!; }
  get cur(): Unit { return this.u(this.s.cur); }
  kit(u: Unit): Kit { return kitOf(u.key); }
  team(flag: string): boolean { return this.s.team.includes(flag); }
  node(u: Unit, id: string): boolean { return u.nodes.includes(id); }
  alliesOf(u: Unit, includeDead = false): Unit[] { return this.s.units.filter((x) => x.side === u.side && (includeDead || x.alive)); }
  foesOf(u: Unit): Unit[] { return this.s.units.filter((x) => x.side !== u.side && x.alive); }
  heroes(): Unit[] { return this.s.units.filter((x) => x.side === 'hero' && x.alive); }
  enemies(): Unit[] { return this.s.units.filter((x) => x.side === 'enemy' && x.alive); }
  byKey(key: string): Unit | undefined { return this.s.units.find((x) => x.key === key && x.alive); }
  adj(t: Unit): Unit[] {
    const row = this.alliesOf(t).sort((a, b) => a.pos - b.pos);
    const i = row.indexOf(t);
    return [row[i - 1], row[i + 1]].filter(Boolean) as Unit[];
  }
  targetable(u: Unit): boolean { return u.alive && !this.has(u, 'invisible'); }
  randFoes(u: Unit, n: number): Unit[] {
    const out: Unit[] = [];
    for (let i = 0; i < n; i++) {
      const l = this.foesOf(u).filter((x) => this.targetable(x));
      if (!l.length) break;
      out.push(this.pick(l));
    }
    return out;
  }

  // --- статусы ---
  st(u: Unit, id: string): Status | undefined { return u.statuses.find((x) => x.id === id); }
  has(u: Unit, id: string): boolean { return !!this.st(u, id); }
  val(u: Unit, id: string): number { return this.st(u, id)?.value ?? 0; }

  immune(u: Unit, id: string): boolean {
    if (CONTROL.includes(id) && (this.has(u, 'stunGuard') || this.has(u, 'berserk') || this.has(u, 'gear5'))) return true;
    if (id === 'silence' && (u.key === 'asta' || u.key === 'rudeus' || u.key === 'sylphy')) return true;
    if ((id === 'stun' || id === 'fear') && u.key === 'stark' && this.node(u, 'C3')) return true;
    if (id === 'charm' && u.key === 'fern') return true;
    return false;
  }

  add(u: Unit, id: string, turns: number, value = 0, data?: Record<string, any>): void {
    if (!u.alive || this.immune(u, id)) return;
    const ex = this.st(u, id);
    if (ex) {
      ex.turns = Math.max(ex.turns, turns);
      ex.value = id === 'shield' ? ex.value + value : Math.max(ex.value, value);
      if (data) ex.data = { ...ex.data, ...data };
      return;
    }
    u.statuses.push({ id, turns, value, data });
    this.ev.push({ k: 'st', uid: u.uid, id, on: true });
  }
  del(u: Unit, id: string): void {
    const i = u.statuses.findIndex((x) => x.id === id);
    if (i >= 0) {
      u.statuses.splice(i, 1);
      this.ev.push({ k: 'st', uid: u.uid, id, on: false });
    }
  }
  dispel(u: Unit, n: number): number {
    let c = 0;
    for (const st of [...u.statuses]) {
      if (c >= n) break;
      if (STATUS[st.id]?.good && st.id !== 'rising' && st.id !== 'stunGuard') { this.del(u, st.id); c++; }
    }
    if (c) this.add(u, 'dispelledMark', 2, 1);
    return c;
  }
  cleanse(u: Unit, only?: string[]): number {
    let c = 0;
    for (const st of [...u.statuses]) {
      if (STATUS[st.id] && !STATUS[st.id].good && (!only || only.includes(st.id))) { this.del(u, st.id); c++; }
    }
    return c;
  }

  // --- текст и числа на экране ---
  say(text: string): void { this.ev.push({ k: 'say', text }); }
  float(u: Unit, text: string, color = '#fff3d6'): void { this.ev.push({ k: 'float', uid: u.uid, text, color }); }

  // --- ресурсы ---
  mp(u: Unit, n: number): void { u.mp = Math.max(0, Math.min(u.maxMp, u.mp + n)); }
  res(u: Unit, key: string, n: number, max = 999, min = 0): number {
    u.res[key] = Math.max(min, Math.min(max, (u.res[key] ?? 0) + n));
    return u.res[key];
  }
  limit(u: Unit, n: number): void {
    if (u.side !== 'hero' || !u.alive) return;
    let k = 1;
    if (u.key === 'yami' && this.node(u, 'B4')) k = 2;
    if (u.key === 'roxy' && this.node(u, 'B4')) k = 1.5;
    if (this.team('sins2')) k *= 1.25;
    u.limit = Math.max(0, Math.min(100, u.limit + n * k));
  }
  extraTurn(u: Unit): void {
    if (u.alive && !this.s.extra.includes(u.uid)) {
      this.s.extra.push(u.uid);
      this.float(u, 'ещё ход!', '#7fffd4');
    }
  }

  // --- множители урона ---
  dealMult(src: Unit, t: Unit, o: HitOpts): number {
    let m = 1 + (this.val(src, 'atkUp') - this.val(src, 'atkDown') - this.val(src, 'fear')) / 100;
    if (this.has(src, 'limitBreak')) m += this.val(src, 'limitBreak') / 100;
    if (this.has(src, 'assault')) m += 1;
    if (o.magic && this.has(src, 'lesson')) m += 0.3;
    const k = this.kit(src).hooks.dealMult;
    if (k) m *= k(this, src, t, o);
    if (src.side === 'hero' && this.byKey('kamina') && src.key !== 'kamina') m *= 1.05;
    if (this.team('frieren3') && ['frieren', 'fern', 'stark'].includes(src.key)) m *= 1.1;
    return Math.max(0.1, m);
  }
  typeMult(t: Unit, o: HitOpts): number {
    const type = o.type ?? 'phys';
    let m = o.ignoreResist ? 1 : (t.resist[type] ?? 1);
    if (this.has(t, 'wet') && (type === 'lightning' || type === 'ice')) m *= 1.3;
    if (t.tags.includes('logia') && type === 'phys' && !this.has(t, 'wet') && !o.haki) m *= 0.25;
    return m;
  }
  takenMult(t: Unit, src: Unit, o: HitOpts): number {
    let m = 1 - this.val(t, 'defUp') / 100 + this.val(t, 'vuln') / 100;
    if (this.has(t, 'exhausted') && !(t.key === 'megumin' && this.node(t, 'B2'))) m += 0.5;
    if (o.tag === 'explosion' && this.has(t, 'mark')) m *= this.val(t, 'mark');
    const k = this.kit(t).hooks.takenMult;
    if (k) m *= k(this, t, src, o);
    for (const a of this.alliesOf(t)) {
      const f = this.kit(a).hooks.allyTakenMult;
      if (f) m *= f(this, a, t, src, o);
    }
    return Math.max(0, m);
  }

  coverFor(t: Unit): Unit | null {
    for (const g of this.alliesOf(t)) {
      if (g === t) continue;
      const st = this.st(g, 'guarding');
      if (st && (st.data?.wards as string[] | undefined)?.includes(t.uid)) return g;
    }
    return null;
  }

  // --- урон ---
  hit(src: Unit, t0: Unit, power: number, o: HitOpts = {}): number {
    if (!t0.alive) return 0;
    let t = t0;
    let share = o.share ?? 1;
    if (o.single !== false && !o.noCover && src.side !== t.side && !o.counter) {
      const mel = this.byKey('meliodas');
      if (mel && mel !== t && mel.side === t.side && this.node(mel, 'B3') && this.val(mel, 'clones') > 0 && !mel.res.cloneCover) {
        mel.res.cloneCover = 1;
        this.float(t, 'копия прикрыла', '#e6c84f');
        return 0;
      }
      const g = this.coverFor(t);
      if (g) {
        this.ev.push({ k: 'cover', uid: g.uid, ward: t.uid });
        share = (this.st(g, 'guarding')!.value || 1) * share;
        t = g;
      }
    }
    // Промах и уклонение
    if (!o.sure && !this.preview && src.side !== t.side) {
      if (this.has(t, 'evadeNext')) {
        const all = this.st(t, 'evadeNext')!.data?.round;
        if (!all) this.del(t, 'evadeNext');
        this.ev.push({ k: 'miss', uid: t.uid, src: src.uid });
        this.kit(t).hooks.onDodge?.(this, t, src);
        if (o.single !== false && src.alive && !o.counter) this.hit(t, src, this.val(t, 'counter') || 1, { counter: true, single: true });
        return 0;
      }
      const chance = t.dodge + this.val(t, 'dodgeUp') / 100 + (1 - (o.acc ?? 1)) + this.val(src, 'accDown') / 100
        - (this.has(t, 'mud') ? 1 : 0) + this.heroDodgeAura(t);
      if (this.rnd() < chance) {
        this.ev.push({ k: 'miss', uid: t.uid, src: src.uid });
        this.kit(t).hooks.onDodge?.(this, t, src);
        return 0;
      }
    }
    // Отражение и поглощение магии
    if (o.magic && !o.reflected && src.side !== t.side) {
      const absorber = this.has(t, 'absorbMagic') ? t
        : this.alliesOf(t).find((a) => this.st(a, 'absorbMagic')?.data?.party);
      if (absorber) {
        const st = this.st(absorber, 'absorbMagic')!;
        if (!st.data?.keep) this.del(absorber, 'absorbMagic');
        this.float(absorber, 'поглощено!', '#d0d0d0');
        this.kit(absorber).hooks.onDamaged?.(this, absorber, src, 0, { ...o, tag: 'absorbed' });
        if (st.value > 0 && src.alive) {
          const targets = st.data?.all ? this.foesOf(absorber) : [src];
          for (const x of targets) this.hit(absorber, x, power * st.value, { ...o, flat: o.flat, reflected: true, sure: true, single: true });
        }
        return 0;
      }
      if (this.has(t, 'reflectMagic')) {
        const st = this.st(t, 'reflectMagic')!;
        if (!st.data?.keep) this.del(t, 'reflectMagic');
        this.float(t, 'контрудар!', '#ffd23f');
        if (t.key === 'meliodas' && this.node(t, 'A3')) this.res(t, 'wrath', 20);
        const base = o.flat ? power : src.atk * power;
        if (src.alive) this.hit(t, src, base * st.value, { ...o, flat: true, reflected: true, sure: true, single: true });
        return 0;
      }
    }
    // Расчёт
    let dmg = o.flat ? power : src.atk * power;
    dmg *= this.dealMult(src, t, o);
    const tm = this.typeMult(t, o);
    dmg *= tm;
    dmg *= this.takenMult(t, src, o);
    const def = Math.max(0, Math.min(0.8, t.def * (1 - (o.pierce ?? 0))));
    dmg *= 1 - def;
    let crit = false;
    if (!this.preview && src.side !== t.side) {
      const cc = src.crit + (o.crit ?? 0) + (this.has(src, 'focus') ? 1 : 0);
      if (this.rnd() < cc) { crit = true; dmg *= o.critMult ?? 1.5; }
    }
    dmg *= share;
    let n = tm === 0 ? 0 : Math.max(1, Math.round(dmg));
    if (o.execute && !t.boss && t.hp - n <= t.maxHp * o.execute) n = t.hp;
    // Щит и блок
    let absorbed = 0;
    if (n > 0 && this.has(t, 'block') && src.side !== t.side) {
      const b = this.st(t, 'block')!;
      b.value -= 1;
      if (b.value <= 0) this.del(t, 'block');
      absorbed = n;
      n = 0;
    }
    if (n > 0 && !o.ignoreShield && this.has(t, 'shield')) {
      const sh = this.st(t, 'shield')!;
      absorbed = Math.min(sh.value, n);
      sh.value -= absorbed;
      n -= absorbed;
      if (sh.data?.reflect && src.alive && src !== t && !o.reflected) {
        this.hit(t, src, absorbed * sh.data.reflect, { flat: true, sure: true, reflected: true, single: true });
      }
      if (sh.value <= 0) this.del(t, 'shield');
    }
    const mod = tm === 0 ? 'immune' : tm > 1.05 ? 'weak' : tm < 0.95 ? 'resist' : null;
    t.hp -= n;
    if (this.has(t, 'deathless') && t.hp < 1) t.hp = 1;
    this.ev.push({ k: 'hit', uid: t.uid, src: src.uid, n, type: o.type ?? 'phys', crit, absorbed, mod });
    if (src.side !== t.side) this.dealt = true;
    if (n > 0 && t.side === 'hero' && src.side === 'enemy') src.res.hitHero = this.s.round;
    if (n > 0) {
      if (o.lifesteal && src.alive) this.heal(src, n * o.lifesteal, true);
      this.limit(t, (n / t.maxHp) * 60);
      if (this.has(t, 'sleep')) this.del(t, 'sleep');
      this.kit(t).hooks.onDamaged?.(this, t, src, n, o);
      this.kit(src).hooks.onDealt?.(this, src, t, n, o);
      if (t.side === 'hero') for (const a of this.heroes()) this.kit(a).hooks.onPartyDamaged?.(this, a, t, n);
    }
    // Контратака
    if (t.alive && t.hp > 0 && src.alive && this.has(t, 'counter') && o.single !== false && !o.counter && !o.reflected && src.side !== t.side) {
      this.hit(t, src, this.val(t, 'counter'), { counter: true, single: true, sure: true });
    }
    if (t.hp <= 0) this.kill(t, src, n);
    return n;
  }

  heroDodgeAura(t: Unit): number {
    if (t.side !== 'hero') return 0;
    const y = this.byKey('yami');
    if (!y || y === t) return 0;
    return this.node(y, 'C1') ? 0.15 : 0.1;
  }

  /** Урон без атакующего: горение, кровотечение, проклятие. */
  raw(t: Unit, n: number, type: DmgType = 'phys', label?: string): void {
    if (!t.alive) return;
    n = Math.max(1, Math.round(n));
    if (this.has(t, 'shield')) {
      const sh = this.st(t, 'shield')!;
      const a = Math.min(sh.value, n);
      sh.value -= a;
      n -= a;
      if (sh.value <= 0) this.del(t, 'shield');
    }
    t.hp -= n;
    if (this.has(t, 'deathless') && t.hp < 1) t.hp = 1;
    this.ev.push({ k: 'hit', uid: t.uid, src: t.uid, n, type, crit: false, absorbed: 0, mod: null });
    if (label) this.float(t, label, STATUS[label]?.color ?? '#fff');
    if (t.hp <= 0) this.kill(t, null, n);
  }

  kill(t: Unit, src: Unit | null, n: number): void {
    if (!t.alive) return;
    // Союзники могут спасти (Последний бастион, телепорт Эмуль)
    for (const a of this.alliesOf(t)) {
      if (a === t) continue;
      const f = this.kit(a).hooks.onAllyFatal;
      if (f && f(this, a, t, n)) { if (t.hp < 1) t.hp = 1; return; }
    }
    const fatal = this.kit(t).hooks.onFatal;
    if (fatal && fatal(this, t)) { if (t.hp < 1) t.hp = 1; this.float(t, 'выстоял!', '#fff3a0'); return; }
    t.hp = 0;
    t.alive = false;
    const keep = t.statuses.filter((x) => x.id === 'rising');
    t.statuses = keep;
    this.ev.push({ k: 'death', uid: t.uid });
    for (const g of this.alliesOf(t)) {
      const st = this.st(g, 'guarding');
      if (st && (st.data?.wards as string[]).includes(t.uid)) this.del(g, 'guarding');
    }
    if (src) this.kit(src).hooks.onKill?.(this, src, t);
    for (const a of [t, ...this.s.units.filter((x) => x.alive)]) this.kit(a).hooks.onAnyDeath?.(this, a, t, src);
    this.checkEnd();
  }

  heal(t: Unit, n: number, quiet = false, overShield = 0): number {
    if (!t.alive) return 0;
    n = Math.round(n);
    const real = Math.min(n, t.maxHp - t.hp);
    t.hp += real;
    if (overShield > 0 && n > real) this.add(t, 'shield', 99, Math.round((n - real) * overShield));
    if (real > 0 || !quiet) this.ev.push({ k: 'heal', uid: t.uid, n: real });
    return real;
  }
  revive(t: Unit, frac: number): void {
    if (t.alive) return;
    t.alive = true;
    t.hp = Math.max(1, Math.round(t.maxHp * frac));
    t.statuses = [];
    t.limit = 0;
    this.ev.push({ k: 'revive', uid: t.uid });
  }

  checkEnd(): void {
    if (this.s.result !== 'ongoing' || this.preview) return;
    if (this.enemies().length === 0) this.s.result = 'victory';
    else if (this.heroes().length === 0 && !this.s.units.some((x) => x.side === 'hero' && this.has(x, 'rising'))) this.s.result = 'defeat';
    if (this.s.result !== 'ongoing') this.ev.push({ k: 'end', result: this.s.result });
  }

  // --- скорость и очередь ---
  speed(u: Unit): number {
    let s = u.spd * (1 + (this.val(u, 'haste') - this.val(u, 'slow')) / 100);
    if (u.key === 'fern' && this.node(u, 'A2') && this.s.round === 1) s += 100;
    if (u.key === 'gs' && this.enemies().some((x) => x.tags.includes('goblin'))) s += 50;
    return s;
  }
  roundOrder(): string[] {
    return this.s.units
      .filter((x) => x.alive || this.has(x, 'rising'))
      .sort((a, b) => this.speed(b) - this.speed(a) || (a.side === 'hero' ? -1 : 1) || a.pos - b.pos)
      .map((x) => x.uid);
  }
  upcoming(n: number): string[] {
    const out = [this.s.cur, ...this.s.extra];
    for (const id of this.s.order.slice(this.s.turn + 1)) if (this.u(id).alive) out.push(id);
    const next = this.roundOrder();
    while (out.length < n && next.length) out.push(...next);
    return out.slice(0, n);
  }

  // --- ход боя ---
  start(): Ev[] {
    this.ev = [];
    for (const u of this.s.units) this.kit(u).hooks.battleStart?.(this, u);
    this.newRound();
    this.advance(true);
    return this.flush();
  }

  private flush(): Ev[] { const e = this.ev; this.ev = []; return e; }

  private newRound(): void {
    this.s.round += 1;
    this.ev.push({ k: 'round', n: this.s.round });
    for (const u of this.s.units) if (u.alive) {
      u.res.cloneCover = 0;
      u.res.roundHit = 0;
      this.kit(u).hooks.roundStart?.(this, u);
    }
    // Поле боя: гроза Рокси
    for (const f of [...this.s.field]) {
      if (f.id === 'storm') {
        const roxy = this.u(f.data!.src);
        for (const x of this.enemies()) {
          this.add(x, 'wet', 2, 1);
          const k = roxy && this.node(roxy, 'B5') ? 2 : 1;
          if (roxy) this.hit(roxy, x, 1.0 * k, { type: 'lightning', magic: true, sure: true, single: false });
        }
        if (roxy && this.node(roxy, 'B3')) for (const h of this.heroes()) this.heal(h, h.maxHp * 0.03, true);
      }
      f.turns -= 1;
      if (f.turns <= 0) this.s.field.splice(this.s.field.indexOf(f), 1);
    }
    this.s.order = this.roundOrder();
    this.s.turn = 0;
    this.s.extra = [];
    this.s.cur = this.s.order[0] ?? this.s.units[0].uid;
  }

  /** Переходит к следующему бойцу, которому нужно решение. */
  advance(first = false): void {
    let guard = 0;
    while (this.s.result === 'ongoing' && guard++ < 200) {
      if (!first) {
        if (this.s.extra.length) this.s.cur = this.s.extra.shift()!;
        else {
          this.s.turn += 1;
          if (this.s.turn >= this.s.order.length) this.newRound();
          else this.s.cur = this.s.order[this.s.turn];
        }
      }
      first = false;
      const u = this.cur;
      if (!u.alive) {
        const r = this.st(u, 'rising');
        if (!r) continue;
        u.statuses = u.statuses.filter((x) => x.id !== 'rising');
        this.revive(u, r.value);
        this.float(u, 'встал!', '#ff5a5a');
        this.kit(u).hooks.onExpire?.(this, u, r);
      }
      this.ev.push({ k: 'turn', uid: u.uid });
      this.turnStart(u);
      if (this.s.result !== 'ongoing') return;
      if (!u.alive) continue;
      const skip = SKIP.find((id) => this.has(u, id));
      if (skip && !this.kit(u).hooks.canActWhileSkipped?.(this, u)) {
        this.ev.push({ k: 'skip', uid: u.uid, why: STATUS[skip].name });
        const st = this.st(u, skip)!;
        st.turns -= 1;
        if (st.turns <= 0) {
          this.del(u, skip);
          if (u.boss && CONTROL.includes(skip)) this.add(u, 'stunGuard', 1, 1);
          if (skip === 'exhausted') this.kit(u).hooks.onExpire?.(this, u, st);
        }
        this.endTurn(u, true);
        continue;
      }
      if (this.has(u, 'charm')) {
        const allies = this.alliesOf(u).filter((x) => x !== u);
        if (allies.length) {
          const t = this.pick(allies);
          this.ev.push({ k: 'use', uid: u.uid, ab: 'charm', name: 'под подчинением', tgt: t.uid, fx: 'melee' });
          this.hit(u, t, 1, { sure: true, single: true });
        }
        this.endTurn(u);
        continue;
      }
      return;
    }
  }

  private turnStart(u: Unit): void {
    for (const k of Object.keys(u.cd)) if (u.cd[k] > 0) u.cd[k] -= 1;
    if (u.side === 'hero' && u.mpRegen) this.mp(u, u.mpRegen);
    const g = this.st(u, 'guarding');
    if (g && !g.data?.keep) this.del(u, 'guarding');
    for (const id of ['burn', 'bleed', 'poison']) {
      const st = this.st(u, id);
      if (st && u.alive) this.raw(u, st.value, id === 'burn' ? 'fire' : 'phys', id);
    }
    const rg = this.st(u, 'regen');
    if (rg && u.alive) this.heal(u, u.maxHp * rg.value / 100, true);
    if (u.alive) this.kit(u).hooks.turnStart?.(this, u);
  }

  endTurn(u: Unit, skipped = false): void {
    for (const st of [...u.statuses]) {
      if (st.turns >= 99 || SKIP.includes(st.id)) continue;
      if (skipped && st.id === 'doom') continue;
      st.turns -= 1;
      if (st.turns <= 0) {
        this.del(u, st.id);
        this.expire(u, st);
      }
    }
  }

  private expire(u: Unit, st: Status): void {
    if (st.id === 'doom' && u.alive) {
      this.say(`Проклятие смерти настигает ${u.nameAcc}!`);
      this.raw(u, st.value, 'dark');
    }
    this.kit(u).hooks.onExpire?.(this, u, st);
  }

  // --- действия ---
  abilities(u: Unit): AbilityDef[] { return this.kit(u).abilities(this, u); }
  ability(u: Unit, id: string): AbilityDef | undefined {
    if (id === PASS.id) return PASS;
    return this.abilities(u).find((a) => a.id === id) ?? ITEM_ABILITIES.find((a) => a.id === id);
  }

  validTargets(u: Unit, a: AbilityDef): Unit[] {
    if (a.targets) return a.targets(this, u);
    const foes = this.foesOf(u).filter((x) => this.targetable(x));
    switch (a.target) {
      case 'enemy': {
        const taunt = foes.filter((x) => this.has(x, 'taunt'));
        return taunt.length ? taunt : foes;
      }
      case 'enemyAny': return foes;
      case 'ally': return this.alliesOf(u);
      case 'allyOther': return this.alliesOf(u).filter((x) => x !== u);
      case 'allyWounded': return this.alliesOf(u).filter((x) => x.hp < x.maxHp);
      case 'allyDead': return this.alliesOf(u, true).filter((x) => !x.alive);
      default: return [];
    }
  }
  needsTarget(a: AbilityDef): boolean {
    return ['enemy', 'enemyAny', 'ally', 'allyOther', 'allyWounded', 'allyDead'].includes(a.target);
  }

  costOf(u: Unit, a: AbilityDef): number {
    if (!a.cost) return 0;
    if (a.magic && this.team('mushoku2') && ['rudeus', 'roxy', 'sylphy'].includes(u.key)) return Math.max(1, Math.round(a.cost * 0.85));
    return a.cost;
  }

  check(u: Unit, a: AbilityDef): string | null {
    if (a.kind === 'item') {
      if (!(this.s.items[a.id] > 0)) return 'Нет в сумке.';
    }
    if (a.kind === 'ult' && u.limit < (a.limit ?? 100)) return `Шкала Предела: ${Math.floor(u.limit)} из ${a.limit ?? 100}.`;
    const cost = this.costOf(u, a);
    if (cost && u.mp < cost && !(u.key === 'edward')) return `Не хватает: ${u.mpName.toLowerCase()} ${u.mp} из ${cost}.`;
    if (a.cd && (u.cd[a.id] ?? 0) > 0) return `Перезарядка: ещё ${u.cd[a.id]} х.`;
    if (a.perBattle && (u.uses[a.id] ?? 0) >= a.perBattle) return 'Уже использовано в этом бою.';
    if (a.magic && this.has(u, 'silence')) return 'Тишина: колдовать нельзя.';
    const c = a.check?.(this, u);
    if (c) return c;
    if (this.needsTarget(a) && this.validTargets(u, a).length === 0) {
      if (a.target === 'allyWounded') return 'Все союзники здоровы.';
      if (a.target === 'allyDead') return 'Все в строю.';
      if (a.target === 'allyOther') return 'Нет союзников рядом.';
      return 'Нет подходящих целей.';
    }
    return null;
  }

  /** Выполнить действие текущего бойца. Возвращает события, включая переход хода. */
  perform(act: Action): Ev[] {
    this.ev = [];
    const u = this.u(act.uid);
    const a = this.ability(u, act.ab)!;
    const t = act.tgt ? this.u(act.tgt) : null;
    this.payAndRun(u, a, t);
    if (this.s.result === 'ongoing') {
      this.endTurn(u);
      this.advance();
    }
    return this.flush();
  }

  private payAndRun(u: Unit, a: AbilityDef, t: Unit | null): void {
    const cost = this.costOf(u, a);
    if (cost) {
      if (u.key === 'edward' && !u.res.freeUsed) {
        u.res.freeUsed = 1;
        this.float(u, 'хлопок!', '#ffd75a');
      } else if (u.key === 'edward' && u.mp < cost) {
        const miss = cost - u.mp;
        u.mp = 0;
        u.hp = Math.max(1, u.hp - miss * 2);
        this.float(u, `−${miss * 2} ОЗ: обмен`, '#ff9a9a');
      } else this.mp(u, -cost);
    }
    if (a.cd) u.cd[a.id] = a.cd + 1;
    if (a.perBattle) u.uses[a.id] = (u.uses[a.id] ?? 0) + 1;
    if (a.kind === 'ult') {
      u.limit = Math.max(0, u.limit - (a.limit ?? 100));
      if (u.res.bulls) { u.res.bulls = 0; this.extraTurn(u); }
    }
    if (a.kind === 'item') this.s.items[a.id] = Math.max(0, (this.s.items[a.id] ?? 0) - 1);
    this.ev.push({ k: 'use', uid: u.uid, ab: a.id, name: a.name, tgt: t?.uid ?? null, fx: a.fx ?? 'melee' });
    // Ловушки Убийцы гоблинов срабатывают на враге, который начинает действие
    if (u.side === 'enemy') {
      const trap = this.s.field.find((f) => f.id === 'trap');
      if (trap && trap.value > 0) {
        trap.value -= 1;
        const gs = this.u(trap.data!.src);
        this.float(u, 'ловушка!', '#ffe14d');
        if (gs) this.hit(gs, u, 1.5, { sure: true, single: false, noCover: true });
        if (u.alive) this.add(u, 'stun', gs && this.node(gs, 'B4') ? 2 : 1, 1);
        if (trap.value <= 0) this.s.field.splice(this.s.field.indexOf(trap), 1);
        if (!u.alive || this.has(u, 'stun')) return;
      }
    }
    this.dealt = false;
    a.run(this, u, t);
    if (this.dealt && a.kind !== 'ult') this.limit(u, u.key === 'megumin' ? 0 : 8);
    this.kit(u).hooks.onAfterAction?.(this, u, a);
    if (u.side === 'enemy' && a.magic) for (const h of this.heroes()) this.kit(h).hooks.onEnemyAction?.(this, h, u, a);
    this.checkEnd();
  }

  /** Решение врага (и подчинённого героя). */
  decide(u: Unit): Action {
    const k = this.kit(u);
    const d = k.decide?.(this, u);
    if (d) return d;
    const usable = this.abilities(u).filter((a) => !this.check(u, a));
    const a = usable[usable.length - 1];
    if (!a) return { uid: u.uid, ab: PASS.id, tgt: null };
    const ts = this.validTargets(u, a);
    return { uid: u.uid, ab: a.id, tgt: this.needsTarget(a) ? (ts[0]?.uid ?? null) : null };
  }

  /** Предсказание результата без изменения боя. */
  previewOf(act: Action): Ev[] {
    const clone = new Engine(structuredClone(this.s));
    clone.preview = true;
    const u = clone.u(act.uid);
    const a = clone.ability(u, act.ab)!;
    const t = act.tgt ? clone.u(act.tgt) : null;
    try {
      a.run(clone, u, t);
    } catch {
      return [];
    }
    return clone.ev;
  }
}

// ---------- Оборона: доступна любому герою ----------

export const PASS: AbilityDef = {
  id: 'pass', name: 'Оборона', label: 'Оборона', icon: 'ui/icons/shield', kind: 'basic', target: 'self', fx: 'buff',
  desc: 'Пропустить ход и получать на 30% меньше урона до следующего хода.',
  run: (e, u) => e.add(u, 'defUp', 1, 30),
};

// ---------- Предметы из сумки ----------

export const ITEM_ABILITIES: AbilityDef[] = [
  {
    id: 'potion', name: 'Зелье лечения', label: 'Зелье', icon: 'items/potion', kind: 'item', target: 'ally', fx: 'heal',
    desc: 'Восстанавливает 40% здоровья союзнику.',
    run: (e, u, t) => {
      const k = u.key === 'gs' && e.node(u, 'C2') ? 2 : 1;
      e.heal(t!, t!.maxHp * 0.4 * k);
    },
  },
  {
    id: 'ether', name: 'Эликсир маны', label: 'Эликсир', icon: 'items/ether', kind: 'item', target: 'ally', fx: 'heal',
    desc: 'Восстанавливает половину маны или энергии союзнику.',
    run: (e, _u, t) => { e.mp(t!, Math.ceil(t!.maxMp / 2)); e.float(t!, '+мана', '#8fc4ff'); },
  },
  {
    id: 'bomb', name: 'Бомба', label: 'Бомба', icon: 'items/bomb', kind: 'item', target: 'allEnemies', fx: 'aoe',
    desc: 'Огненный взрыв по всем врагам.',
    run: (e, u) => { for (const x of e.enemies()) e.hit(u, x, 1.2, { type: 'fire', sure: true, single: false }); },
  },
  {
    id: 'phoenix', name: 'Перо феникса', label: 'Перо', icon: 'items/phoenix', kind: 'item', target: 'allyDead', fx: 'heal',
    desc: 'Поднимает павшего союзника с 40% здоровья.',
    run: (e, _u, t) => e.revive(t!, 0.4),
  },
  {
    id: 'scroll', name: 'Свиток защиты', label: 'Свиток', icon: 'items/scroll', kind: 'item', target: 'allAllies', fx: 'buff',
    desc: 'Щит всему отряду на 20% здоровья каждого.',
    run: (e, u) => { for (const h of e.alliesOf(u)) e.add(h, 'shield', 99, Math.round(h.maxHp * 0.2)); },
  },
];
