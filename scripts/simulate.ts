// Прогон боя без графики: проверка баланса для разных стратегий игрока.
// Запуск: npm run sim
import {
  advance,
  checkAbility,
  createBattle,
  currentUnitId,
  def,
  enemyDecide,
  living,
  perform,
  preview,
  startBattle,
} from '../src/battle/engine';
import type { Action, BattleState } from '../src/battle/types';

type Strategy = (s: BattleState, actor: string) => Action;

const basic: Record<string, string> = { warrior: 'strike', mage: 'staffMage', archer: 'shot', healer: 'staffHealer' };
const skill: Record<string, string> = { warrior: 'guard', mage: 'fireball', archer: 'aimed', healer: 'heal' };

function rand<T>(l: T[]): T {
  return l[Math.floor(Math.random() * l.length)];
}

/** Новичок: базовые атаки по случайной цели. */
const naive: Strategy = (s, actor) => {
  const c = checkAbility(s, actor, basic[actor]);
  return { actor, ability: basic[actor], target: rand(c.ok ? c.targets : []) };
};

/** Случайные доступные действия. */
const randomPlay: Strategy = (s, actor) => {
  const opts = [basic[actor], skill[actor]].filter((a) => checkAbility(s, actor, a).ok);
  const ab = rand(opts);
  const c = checkAbility(s, actor, ab);
  return { actor, ability: ab, target: rand(c.ok ? c.targets : []) };
};

/** Тактик: убрать лекаря, огонь по броневику, защита цели замаха, лечение. */
const smart: Strategy = (s, actor) => {
  const enemies = living(s, 'enemy').map((u) => u.id);
  const focus = ['sprout', 'goblin', 'brute'].find((id) => enemies.includes(id))!;
  const windupOn = s.units.brute.alive ? s.units.brute.windupTarget : null;
  const can = (a: string) => checkAbility(s, actor, a).ok;
  if (actor === 'warrior') {
    if (windupOn && windupOn !== 'warrior' && can('guard') && s.units[windupOn].guardedBy !== 'warrior') {
      return { actor, ability: 'guard', target: windupOn };
    }
    return { actor, ability: 'strike', target: focus === 'brute' ? 'brute' : focus };
  }
  if (actor === 'mage') {
    if (s.units.brute.alive && can('fireball') && (focus === 'brute' || s.units.sprout.alive === false)) {
      return { actor, ability: 'fireball', target: 'brute' };
    }
    if (can('fireball') && focus !== 'brute') {
      // Добить, если огонь убивает.
      const p = preview(s, { actor, ability: 'fireball', target: focus });
      if (p.amount >= s.units[focus].hp - 3) return { actor, ability: 'fireball', target: focus };
    }
    return { actor, ability: 'staffMage', target: focus };
  }
  if (actor === 'archer') {
    if (can('aimed') && focus !== 'brute') return { actor, ability: 'aimed', target: focus };
    return { actor, ability: 'shot', target: focus };
  }
  // healer
  const wounded = living(s, 'hero')
    .filter((u) => u.hp <= def(u.id).maxHp * 0.55)
    .sort((a, b) => a.hp / def(a.id).maxHp - b.hp / def(b.id).maxHp);
  if (wounded.length && can('heal')) return { actor, ability: 'heal', target: wounded[0].id };
  return { actor, ability: 'staffHealer', target: focus };
};

function run(strategy: Strategy, seed: number) {
  const s = createBattle(seed);
  startBattle(s);
  let guardSaves = 0;
  while (s.result === 'ongoing' && s.round < 60) {
    const id = currentUnitId(s)!;
    const action = def(id).side === 'hero' ? strategy(s, id) : enemyDecide(s, id);
    const ev = perform(s, action);
    for (const e of ev) if (e.type === 'damage' && e.redirectedFrom) guardSaves++;
    advance(s);
  }
  const heroHp = living(s, 'hero').reduce((n, u) => n + u.hp, 0);
  const alive = living(s, 'hero').length;
  return { win: s.result === 'victory', rounds: s.round, heroHp, alive, guardSaves };
}

for (const [name, strat] of Object.entries({ naive, randomPlay, smart })) {
  const N = 2000;
  let wins = 0, rounds = 0, hp = 0, alive = 0, saves = 0;
  for (let i = 0; i < N; i++) {
    const r = run(strat, i * 7919 + 13);
    if (r.win) { wins++; hp += r.heroHp; alive += r.alive; }
    rounds += r.rounds; saves += r.guardSaves;
  }
  console.log(
    `${name.padEnd(10)} побед ${(100 * wins / N).toFixed(1).padStart(5)}%  раундов ${(rounds / N).toFixed(1)}  ` +
    `ОЗ после победы ${(hp / Math.max(1, wins)).toFixed(0)}/112  живых ${(alive / Math.max(1, wins)).toFixed(2)}  защит ${(saves / N).toFixed(1)}`,
  );
}
