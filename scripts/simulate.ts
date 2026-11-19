// Прогон кампании без графики: ошибки в умениях и баланс по регионам.
// Запуск: npm run sim [кампаний=20] [стресс=1]
import { Engine, ITEM_ABILITIES, type Action, type BattleState, type Unit } from '../src/battle/core';
import { HERO, HEROES } from '../src/data/kit';
import { REGIONS } from '../src/data/regions';
import {
  applyResult, canBuy, freePoints, makeBattle, newSave, regionOf, tryJoin, markDone, type Save, type BattleSetup,
} from '../src/game/progress';

const CAMPAIGNS = Number(process.argv[2] ?? 20);
const STRESS = Number(process.argv[3] ?? 1);

let seed = 12345;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = <T>(l: T[]): T => l[Math.floor(rnd() * l.length)];

/** Простой игрок: ульта, лечение раненых, иначе случайное умение. */
function heroAct(e: Engine, u: Unit): Action {
  const abs = e.abilities(u).filter((a) => !e.check(u, a));
  const items = ITEM_ABILITIES.filter((a) => !e.check(u, a));
  const wounded = e.alliesOf(u).filter((x) => x.hp < x.maxHp * 0.4);
  const tgt = (a: (typeof abs)[0]): string | null => {
    if (!e.needsTarget(a)) return null;
    const l = e.validTargets(u, a);
    if (a.target === 'enemy' || a.target === 'enemyAny') return l.sort((x, y) => x.hp - y.hp)[0]?.uid ?? null;
    if (a.target === 'allyDead') return l[0]?.uid ?? null;
    return l.sort((x, y) => x.hp / x.maxHp - y.hp / y.maxHp)[0]?.uid ?? null;
  };
  const dead = e.alliesOf(u, true).some((x) => !x.alive);
  if (dead) { const ph = items.find((a) => a.id === 'phoenix'); if (ph && rnd() < 0.5) return { uid: u.uid, ab: ph.id, tgt: tgt(ph) }; }
  if (wounded.length) {
    const h = abs.find((a) => a.fx === 'heal' && a.kind !== 'item');
    if (h) return { uid: u.uid, ab: h.id, tgt: tgt(h) };
    const p = items.find((a) => a.id === 'potion');
    if (p && rnd() < 0.3) return { uid: u.uid, ab: p.id, tgt: tgt(p) };
  }
  const ult = abs.find((a) => a.kind === 'ult');
  if (ult) return { uid: u.uid, ab: ult.id, tgt: tgt(ult) };
  const skills = abs.filter((a) => a.kind === 'skill' && a.fx !== 'heal');
  const basic = abs.find((a) => a.kind === 'basic');
  const a = skills.length && (rnd() < 0.6 || !basic) ? pick(skills) : basic ?? abs[0];
  if (!a) return { uid: u.uid, ab: 'pass', tgt: null };
  return { uid: u.uid, ab: a.id, tgt: tgt(a) };
}

function fight(setup: BattleSetup): { st: BattleState; rounds: number } {
  const e = new Engine(setup.state);
  e.start();
  let guard = 0;
  while (e.s.result === 'ongoing' && guard++ < 900) {
    const u = e.cur;
    const act = u.side === 'hero' ? heroAct(e, u) : e.decide(u);
    const a = e.ability(u, act.ab);
    if (!a) throw new Error(`${u.key}: нет умения ${act.ab}`);
    if (u.side === 'hero' && e.check(u, a)) throw new Error(`${u.key}: ${a.id} недоступно: ${e.check(u, a)}`);
    e.previewOf(act);
    try { e.perform(act); } catch (err) { throw new Error(`${u.key} ${act.ab} -> ${act.tgt} round ${e.s.round}: ${(err as Error).message}`); }
  }
  if (e.s.result === 'ongoing') { e.s.result = 'defeat'; stalls.push(setup.title + ' ' + setup.state.units.filter((x) => x.side === 'hero').map((x) => x.key).join(',')); }
  return { st: e.s, rounds: e.s.round };
}

function autoBuy(s: Save): void {
  for (const k of Object.keys(s.heroes)) {
    const h = s.heroes[k];
    let guard = 0;
    while (freePoints(h) > 0 && guard++ < 40) {
      const opts = ['A', 'B', 'C'].map((b) => b + (h.nodes.filter((n) => n[0] === b).length + 1)).filter((id) => !canBuy(h, id));
      if (!opts.length) break;
      h.nodes.push(pick(opts));
    }
  }
}

const stalls: string[] = [];
const stats: Record<string, { n: number; win: number; rounds: number }> = {};
const errors = new Map<string, number>();
function rec(key: string, win: boolean, rounds: number): void {
  const r = (stats[key] ??= { n: 0, win: 0, rounds: 0 });
  r.n++; if (win) r.win++; r.rounds += rounds;
}

function campaign(): number {
  const s = newSave();
  for (const r of REGIONS) {
    s.region = r.id;
    // Новый регион — новый случайный отряд из открытых (обязательно с новичками).
    const owned = Object.keys(s.heroes);
    s.party = [...owned].sort(() => rnd() - 0.5).slice(0, 4);
    for (let i = 0; i < r.stages.length; i++) {
      const st = r.stages[i];
      if (st.kind === 'town' || st.kind === 'camp' || st.kind === 'event') {
        for (const h of Object.values(s.heroes)) h.hp = st.kind === 'camp' ? Math.min(1, h.hp + 0.5) : 1;
        markDone(s, r.id, i);
        tryJoin(s, st);
        continue;
      }
      autoBuy(s);
      let won = false;
      for (let attempt = 0; attempt < 4 && !won; attempt++) {
        if (attempt > 0) for (const h of Object.values(s.heroes)) h.hp = 1;
        if (st.kind === 'boss' || st.kind === 'elite') for (const h of Object.values(s.heroes)) h.hp = 1;
        const setup = makeBattle(s, r.id, st.enemies!, st.kind === 'boss' ? 'boss' : st.kind === 'elite' ? 'elite' : 'battle', i, st.name);
        let res;
        try {
          res = fight(setup);
        } catch (err) {
          const m = String((err as Error).stack ?? err).split('\n').slice(0, 3).join(' | ');
          errors.set(m, (errors.get(m) ?? 0) + 1);
          return r.id;
        }
        const win = res.st.result === 'victory';
        rec(`${String(r.id).padStart(2)} ${st.kind.padEnd(6)}`, win, res.rounds);
        if (st.kind === 'boss') rec(`boss try ${attempt}`, win, res.rounds);
        applyResult(s, setup, res.st);
        won = win;
        if (!win) {
          // Гринд: ещё пара боёв в регионе перед новой попыткой.
          for (let g = 0; g < 2; g++) {
            for (const h of Object.values(s.heroes)) h.hp = 1;
            const prev = r.stages.slice(0, i).filter((x) => x.enemies && x.kind === 'battle');
            const p = prev.length ? pick(prev) : st;
            const hs = makeBattle(s, r.id, p.enemies!, 'hunt', null, 'охота');
            try { applyResult(s, hs, fight(hs).st); } catch { /* учтено выше */ }
          }
          autoBuy(s);
        }
      }
      if (!won) return r.id;
    }
  }
  return 99;
}

/** Стресс: каждый герой со всеми узлами в случайных отрядах против всех боссов. */
function stress(): void {
  const keys = HEROES.map((h) => h.key);
  for (let rep = 0; rep < STRESS; rep++) {
    for (const r of REGIONS) {
      for (let k = 0; k < keys.length; k += 4) {
        const s = newSave();
        s.heroes = {};
        s.party = [];
        const team = [...keys.slice(k, k + 4)];
        while (team.length < 4) team.push(pick(keys.filter((x) => !team.includes(x))));
        for (const key of team) {
          const all = ['A', 'B', 'C'].flatMap((b) => [1, 2, 3, 4, 5].map((i) => b + i));
          s.heroes[key] = { level: r.id * 3, xp: 0, nodes: rnd() < 0.5 ? all : [], hp: 1, weapon: 3, armor: 3 };
          s.party.push(key);
        }
        s.items = { potion: 3, ether: 2, bomb: 2, phoenix: 1, scroll: 1 };
        const boss = r.stages[r.stages.length - 1];
        const setup = makeBattle(s, r.id, boss.enemies!, 'boss', null, 'стресс');
        try { fight(setup); } catch (err) {
          const m = `[${team.join(',')}] ` + String((err as Error).stack ?? err).split('\n').slice(0, 3).join(' | ');
          errors.set(m, (errors.get(m) ?? 0) + 1);
        }
      }
    }
  }
}

stress();
const reached: number[] = [];
for (let c = 0; c < CAMPAIGNS; c++) reached.push(campaign());

console.log('Регион, где кампания остановилась (99 = пройдена):', reached.sort((a, b) => a - b).join(' '));
console.log('\nПобеды по этапам:');
for (const k of Object.keys(stats).sort()) {
  const r = stats[k];
  console.log(`${k}  ${String(Math.round((r.win / r.n) * 100)).padStart(3)}%  боёв ${String(r.n).padStart(4)}  раундов ${(r.rounds / r.n).toFixed(1)}`);
}
if (stalls.length) console.log('\nЗатяжные бои:', stalls.length, stalls.slice(0, 8).join(' / '));
if (errors.size) {
  console.log('\nОШИБКИ:');
  for (const [m, n] of errors) console.log(n, '×', m);
  process.exitCode = 1;
} else console.log('\nОшибок нет.');
void HERO; void regionOf;
