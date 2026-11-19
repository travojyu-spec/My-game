import { ABILITIES, RULES, UNITS, UNIT_BY_ID } from '../config/balance';
import type {
  AbilityCheck,
  AbilityDef,
  Action,
  BattleEvent,
  BattleState,
  DamageType,
  UnitDef,
  UnitState,
} from './types';

// ---------- Случайные числа (mulberry32), состояние хранится в BattleState ----------

export function nextRandom(state: BattleState): number {
  let t = (state.rngSeed = (state.rngSeed + 0x6d2b79f5) | 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function pick<T>(state: BattleState, list: T[]): T {
  return list[Math.floor(nextRandom(state) * list.length)];
}

// ---------- Создание боя ----------

export function createBattle(seed = Date.now() | 0, units: UnitDef[] = UNITS): BattleState {
  const state: BattleState = {
    version: 1,
    round: 0,
    order: [],
    turnIndex: 0,
    units: {},
    result: 'ongoing',
    rngSeed: seed,
  };
  for (const def of units) {
    state.units[def.id] = {
      id: def.id,
      hp: def.maxHp,
      mp: def.maxMp,
      alive: true,
      guardedBy: null,
      guarding: null,
      windupTarget: null,
      barrier: false,
      guardOnce: false,
      exhausted: false,
    };
  }
  return state;
}

// ---------- Справочные функции ----------

export const def = (id: string): UnitDef => UNIT_BY_ID[id];
export const ability = (id: string): AbilityDef => ABILITIES[id];

export function living(state: BattleState, side?: 'hero' | 'enemy'): UnitState[] {
  return Object.values(state.units).filter((u) => u.alive && (!side || def(u.id).side === side));
}

export function currentUnitId(state: BattleState): string | null {
  return state.order[state.turnIndex] ?? null;
}

/** Порядок на раунд: живые бойцы по скорости, при равенстве герои раньше. */
export function roundOrder(state: BattleState): string[] {
  return living(state).filter((u) => !u.exhausted)
    .map((u) => def(u.id))
    .sort((a, b) => b.speed - a.speed || (a.side === 'hero' ? -1 : 1))
    .map((d) => d.id);
}

/** Ближайшие ходы, начиная с текущего, для полосы очерёдности. */
export function upcomingTurns(state: BattleState, count: number): string[] {
  const out: string[] = [];
  const rest = state.order.slice(state.turnIndex).filter((id) => state.units[id].alive);
  out.push(...rest);
  const next = roundOrder(state);
  while (out.length < count && next.length > 0) out.push(...next);
  return out.slice(0, count);
}

export function damageMultiplier(targetId: string, type: DamageType): number {
  return def(targetId).resist?.[type] ?? 1;
}

function scaled(power: number, mult: number): number {
  return Math.max(1, Math.round(power * mult));
}

// ---------- Проверка способностей ----------

export function validTargets(state: BattleState, actorId: string, abilityId: string): string[] {
  const a = ability(abilityId);
  const side = def(actorId).side;
  const foe = side === 'hero' ? 'enemy' : 'hero';
  switch (a.target) {
    case 'enemy':
      return living(state, foe).map((u) => u.id);
    case 'ally':
      return living(state, side).map((u) => u.id);
    case 'ally-other':
      return living(state, side).filter((u) => u.id !== actorId).map((u) => u.id);
    case 'ally-wounded':
      return living(state, side).filter((u) => u.hp < def(u.id).maxHp).map((u) => u.id);
  }
}

export function checkAbility(state: BattleState, actorId: string, abilityId: string): AbilityCheck {
  const a = ability(abilityId);
  const actor = state.units[actorId];
  if (!a || !actor?.alive || actor.exhausted || !def(actorId).abilities.includes(abilityId)) {
    return { ok: false, reason: 'Действие недоступно.' };
  }
  if (a.cost > actor.mp) {
    return { ok: false, reason: `Не хватает маны: нужно ${a.cost}, есть ${actor.mp}.` };
  }
  const targets = validTargets(state, actorId, abilityId);
  if (targets.length === 0) {
    if (a.target === 'ally-wounded') return { ok: false, reason: 'Все союзники здоровы — лечить некого.' };
    if (a.target === 'ally-other') return { ok: false, reason: 'Некого защищать: союзников не осталось.' };
    return { ok: false, reason: 'Нет подходящих целей.' };
  }
  return { ok: true, targets };
}

export interface Preview {
  kind: 'damage' | 'heal' | 'guard';
  amount: number;
  /** Кто реально получит удар (защитник), если не цель. */
  takenBy: string | null;
  mod: 'weak' | 'resist' | null;
}

/** Предсказание результата для подсказки перед подтверждением. */
export function preview(state: BattleState, action: Action): Preview {
  const a = ability(action.ability);
  const eff = a.effect;
  if (eff.kind === 'heal') {
    const t = state.units[action.target];
    return { kind: 'heal', amount: Math.min(eff.power, def(t.id).maxHp - t.hp), takenBy: null, mod: null };
  }
  if (eff.kind === 'guard') return { kind: 'guard', amount: 0, takenBy: null, mod: null };
  const baseMult = damageMultiplier(action.target, eff.type);
  const mult = eff.ignoreArmor && baseMult < 1 ? 1 : baseMult;
  let amount = scaled(eff.power, mult);
  const mod = mult > 1 ? 'weak' : mult < 1 ? 'resist' : null;
  if (state.units[action.target].barrier) amount = Math.max(1, Math.ceil(amount / 2));
  const guard = state.units[action.target].guardedBy;
  if (guard && state.units[guard].alive) {
    amount = Math.max(1, Math.ceil(amount * RULES.guardDamageShare));
    return { kind: 'damage', amount, takenBy: guard, mod };
  }
  return { kind: 'damage', amount, takenBy: null, mod };
}

// ---------- Ход ----------

function clearGuard(state: BattleState, guardId: string, events: BattleEvent[]): void {
  const g = state.units[guardId];
  if (g.guarding) {
    const ward = state.units[g.guarding];
    if (ward.guardedBy === guardId) ward.guardedBy = null;
    events.push({ type: 'guardEnd', guard: guardId, ward: g.guarding });
    g.guarding = null;
  }
}

/** Начало хода текущего бойца: восстановление маны, конец прошлой защиты. */
export function beginTurn(state: BattleState): BattleEvent[] {
  const id = currentUnitId(state);
  if (!id) return [];
  const u = state.units[id];
  const d = def(id);
  const events: BattleEvent[] = [];
  clearGuard(state, id, events);
  let mpGain = 0;
  if (d.side === 'hero' && u.mp < d.maxMp) {
    mpGain = Math.min(RULES.manaRegenPerTurn, d.maxMp - u.mp);
    u.mp += mpGain;
  }
  events.unshift({ type: 'turnStart', unit: id, round: state.round, mpGain });
  return events;
}

/** Переход к следующему живому бойцу. Возвращает события начала его хода. */
export function advance(state: BattleState): BattleEvent[] {
  if (state.result !== 'ongoing') return [];
  let idx = state.turnIndex + 1;
  for (;;) {
    if (idx >= state.order.length) {
      state.round += 1;
      state.order = roundOrder(state);
      idx = 0;
    }
    if (state.units[state.order[idx]].alive && !state.units[state.order[idx]].exhausted) break;
    idx += 1; // побеждённые пропускают ход
  }
  state.turnIndex = idx;
  return beginTurn(state);
}

/** Запуск боя: первый раунд и начало первого хода. */
export function startBattle(state: BattleState): BattleEvent[] {
  state.round = 1;
  state.order = roundOrder(state);
  state.turnIndex = 0;
  return beginTurn(state);
}

function kill(state: BattleState, id: string, events: BattleEvent[]): void {
  const u = state.units[id];
  u.alive = false;
  u.hp = 0;
  u.windupTarget = null;
  events.push({ type: 'death', unit: id });
  // Погибший воин больше никого не защищает.
  clearGuard(state, id, events);
  if (u.guardedBy) u.guardedBy = null;
}

function checkEnd(state: BattleState, events: BattleEvent[]): void {
  if (living(state, 'enemy').length === 0) {
    state.result = 'victory';
    events.push({ type: 'end', result: 'victory' });
  } else if (living(state, 'hero').length === 0) {
    state.result = 'defeat';
    events.push({ type: 'end', result: 'defeat' });
  }
}

/** Выполнить действие. Предполагается, что оно прошло проверку checkAbility. */
export function perform(state: BattleState, action: Action): BattleEvent[] {
  const events: BattleEvent[] = [];
  if (state.result !== 'ongoing' || currentUnitId(state) !== action.actor) return events;
  const allowed = checkAbility(state, action.actor, action.ability);
  if (!allowed.ok || !allowed.targets.includes(action.target)) return events;
  const a = ability(action.ability);
  const actor = state.units[action.actor];
  actor.mp -= a.cost;
  events.push({ type: 'use', actor: action.actor, ability: action.ability, target: action.target });

  if (action.ability === 'windup') {
    actor.windupTarget = action.target;
    events.push({ type: 'windup', actor: action.actor, target: action.target });
    return events;
  }
  if (a.fx === 'slam') actor.windupTarget = null;

  const eff = a.effect;
  if (eff.kind === 'guard') {
    const ward = state.units[action.target];
    // Если союзника уже кто-то защищал, старая защита снимается.
    if (ward.guardedBy) clearGuard(state, ward.guardedBy, events);
    ward.barrier = false;
    if (eff.barrier) {
      ward.barrier = true;
    } else {
      clearGuard(state, action.actor, events);
      actor.guarding = action.target;
      actor.guardOnce = Boolean(eff.once);
      ward.guardedBy = action.actor;
    }
    events.push({ type: 'guard', guard: action.actor, ward: action.target });
  } else if (eff.kind === 'heal') {
    const t = state.units[action.target];
    const amount = Math.min(eff.power, def(t.id).maxHp - t.hp);
    t.hp += amount;
    events.push({ type: 'heal', source: action.actor, target: action.target, amount });
  } else {
    const targets = eff.all
      ? living(state, def(action.actor).side === 'hero' ? 'enemy' : 'hero').map((u) => u.id)
      : [action.target];
    for (const target of targets) {
      const p = preview(state, { ...action, target });
      const victimId = p.takenBy ?? target;
      const victim = state.units[victimId];
      state.units[target].barrier = false;
      victim.hp = Math.max(0, victim.hp - p.amount);
      events.push({ type: 'damage', source: action.actor, target: victimId,
        redirectedFrom: p.takenBy ? target : null, amount: p.amount, damageType: eff.type, mod: p.mod });
      if (p.takenBy && victim.guardOnce) clearGuard(state, p.takenBy, events);
      if (victim.hp <= 0) kill(state, victimId, events);
    }
    if (eff.exhaust) actor.exhausted = true;
  }
  checkEnd(state, events);
  return events;
}

// ---------- Поведение врагов ----------

export function enemyDecide(state: BattleState, actorId: string): Action {
  const d = def(actorId);
  const me = state.units[actorId];
  const heroes = living(state, 'hero');
  switch (d.brain) {
    case 'goblin': {
      // Самый раненый по текущему здоровью, при равенстве — первый по списку.
      const target = heroes.reduce((a, b) => (b.hp < a.hp ? b : a));
      return { actor: actorId, ability: d.abilities[0], target: target.id };
    }
    case 'brute': {
      if (me.windupTarget && state.units[me.windupTarget].alive) {
        return { actor: actorId, ability: d.abilities[1] ?? 'slam', target: me.windupTarget };
      }
      // Замахивается на случайного героя; воина выбирает, только если остался один.
      const pool = heroes.length > 1 ? heroes.filter((h) => h.id !== 'warrior') : heroes;
      return { actor: actorId, ability: 'windup', target: pick(state, pool).id };
    }
    case 'sprout': {
      const allies = living(state, 'enemy')
        .map((u) => ({ u, missing: def(u.id).maxHp - u.hp }))
        .filter((x) => x.missing >= RULES.sproutHealThreshold)
        .sort((a, b) => b.missing - a.missing);
      if (allies.length > 0) return { actor: actorId, ability: d.abilities[0], target: allies[0].u.id };
      return { actor: actorId, ability: d.abilities[1], target: pick(state, heroes).id };
    }
    default:
      return { actor: actorId, ability: d.abilities[0], target: pick(state, heroes).id };
  }
}
