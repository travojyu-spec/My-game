// Защитники и бойцы.
import type { AbilityDef, Engine, HitOpts, Unit } from '../battle/core';
import { I, N, avgHp, hero, mostWounded, node } from './kit';

const rapture = (e: Engine, u: Unit, n: number) => e.res(u, 'rapture', n, N(u, 'B1') ? 15 : 10);

// ===================== Даркнесс =====================
hero({
  key: 'darkness', name: 'Даркнесс', nameAcc: 'Даркнесс', role: 'tank', work: 'Коносуба', color: '#e8c45a',
  hp: 150, atk: 11, def: 0.3, spd: 3, mp: 6, mpRegen: 2, mpName: 'Энергия', dodge: 0, tags: ['female'],
  passive: 'Чем больнее, тем лучше: каждый полученный удар — стак Упоения (+4% защиты). Её меч попадает лишь в 30% случаев.',
  mods: { A1: { hp: 0.15 } },
  tree: {
    A: ['Крестоносец', [node('Крепкая', '+15% здоровья'), node('Упрямая', '«Ко мне!» длится 3 хода'), node('Аура', 'Союзники получают на 10% меньше урона'), node('Двойной щит', '«Живой щит» прикрывает ещё и самого раненого союзника'), node('Последний бастион', 'Раз за раунд смертельный удар по союзнику принимает на себя')]],
    B: ['Упоение', [node('Ненасытная', 'До 15 стаков Упоения'), node('Блаженство', 'В начале хода лечит 1% за каждый стак'), node('Ответ', 'При 10+ стаках отвечает ударом на каждый удар'), node('Разогрев', 'Начинает бой с 5 стаками'), node('Экстаз', 'Раз за бой при ОЗ ниже 30% сбрасывает стаки и лечится на 5% за каждый')]],
    C: ['Вечный промах', [node('Тренировка', '+10% попадания'), node('Не сдаётся', 'Промах даёт стак Упоения'), node('Тренировка II', 'Ещё +10% попадания'), node('Тяжёлая рука', 'Попадание оглушает на ход'), node('Наконец-то!', 'Меч всегда попадает и сильнее на 8% за стак')]],
  },
  abilities: () => [
    {
      id: 'd_strike', name: 'Удар мечом', label: 'Меч', icon: I.sword, kind: 'basic', target: 'enemy', fx: 'melee',
      desc: 'Сильный удар, но попадает лишь в 30% случаев.',
      run: (e, u, t) => {
        const sure = N(u, 'C5');
        const acc = sure ? 1 : 0.3 + (N(u, 'C1') ? 0.1 : 0) + (N(u, 'C3') ? 0.1 : 0);
        const p = 2.0 * (sure ? 1 + 0.08 * (u.res.rapture ?? 0) : 1);
        const n = e.hit(u, t!, p, { acc, sure });
        if (n === 0 && N(u, 'C2')) rapture(e, u, 1);
        if (n > 0 && N(u, 'C4') && t!.alive) e.add(t!, 'stun', 1, 1);
      },
    },
    {
      id: 'd_taunt', name: 'Ко мне!', label: 'Ко мне', icon: 'icons/taunt', kind: 'skill', target: 'self', cost: 2, fx: 'buff',
      desc: 'Провоцирует всех врагов на 2 хода.',
      run: (e, u) => { e.add(u, 'taunt', N(u, 'A2') ? 3 : 2, 1); e.float(u, 'Ко мне!', '#ff5a3c'); },
    },
    {
      id: 'd_cover', name: 'Живой щит', label: 'Щит', icon: I.shield, kind: 'skill', target: 'allyOther', cost: 2, fx: 'buff',
      desc: 'До своего хода принимает удары за союзника.',
      run: (e, u, t) => {
        const wards = [t!.uid];
        if (N(u, 'A4')) { const o = mostWounded(e, u, u); if (o && o !== t) wards.push(o.uid); }
        e.add(u, 'guarding', 1, 1, { wards });
      },
    },
    {
      id: 'd_ult', name: 'Несгибаемая', label: 'Ульта', icon: 'icons/d_ult', kind: 'ult', target: 'self', fx: 'buff',
      desc: '2 хода не падает ниже 1 ОЗ и провоцирует всех врагов.',
      run: (e, u) => { e.add(u, 'deathless', 2, 1); e.add(u, 'taunt', 2, 1); },
    },
  ],
  hooks: {
    battleStart: (_e, u) => { u.res.rapture = N(u, 'B4') ? 5 : 0; },
    takenMult: (_e, u) => 1 - 0.04 * (u.res.rapture ?? 0),
    onDamaged: (e, u, src, _n, o) => {
      rapture(e, u, 1);
      if (N(u, 'B3') && (u.res.rapture ?? 0) >= 10 && src.alive && !o.counter && src.side !== u.side) e.hit(u, src, 1, { counter: true, sure: true, single: true });
    },
    turnStart: (e, u) => {
      if (N(u, 'B2')) e.heal(u, u.maxHp * 0.01 * (u.res.rapture ?? 0), true);
      if (N(u, 'B5') && !u.res.ecstasy && u.hp < u.maxHp * 0.3 && (u.res.rapture ?? 0) >= 5) {
        u.res.ecstasy = 1;
        e.float(u, 'Экстаз!', '#ff8ad8');
        e.heal(u, u.maxHp * 0.05 * u.res.rapture);
        u.res.rapture = 0;
      }
    },
    allyTakenMult: (_e, u, ally) => (N(u, 'A3') && ally !== u ? 0.9 : 1),
    onAllyFatal: (e, u, ally, n) => {
      if (!N(u, 'A5') || !u.alive || u.res.bastion === e.s.round || ally.side !== u.side) return false;
      u.res.bastion = e.s.round;
      e.float(ally, 'бастион!', '#e8c45a');
      e.raw(u, n);
      return true;
    },
    resLine: (_e, u) => `Упоение: ${u.res.rapture ?? 0}`,
  },
});

// ===================== Гатс =====================
hero({
  key: 'guts', name: 'Гатс', nameAcc: 'Гатса', role: 'tank', work: 'Берсерк', color: '#3b3b46',
  hp: 135, atk: 13, def: 0.15, spd: 4, mp: 6, mpRegen: 2, mpName: 'Энергия',
  passive: 'Борец: первый смертельный удар за бой оставляет 1 ОЗ; ниже 30% здоровья +30% урона. Ярость копится от каждого полученного удара.',
  mods: { B1: { hp: 0.15 } },
  tree: {
    A: ['Убийца драконов', [node('Размах', 'Соседи получают 70% вместо 50%'), node('Рваные раны', 'Удар вызывает кровотечение'), node('Сокрушение', '25% шанс оглушить цель (не босса)'), node('Ярость клинка', '+2% урона за каждую Ярость'), node('Рассечь всех', 'Убийца драконов бьёт всех врагов')]],
    B: ['Чёрный мечник', [node('Шрамы', '+15% здоровья'), node('Жажда боя', '+5% ОЗ за каждого убитого врага'), node('Неубиваемый', '«Борец» срабатывает дважды'), node('Глубже во тьму', 'Доспех держится 4 хода'), node('Без цены', 'После доспеха нет потери ОЗ и отката')]],
    C: ['Протез', [node('Быстрая перезарядка', 'Ручная пушка перезаряжается за 2 хода'), node('Отравленные ножи', 'Ножи вызывают кровотечение'), node('Картечь', 'Пушка задевает соседей цели'), node('Полный пояс', '5 ножей вместо 3'), node('Арсенал', 'После каждого умения — бесплатный выстрел из пушки')]],
  },
  abilities: () => [
    {
      id: 'g_slay', name: 'Убийца драконов', label: 'Меч', icon: I.sword, kind: 'basic', target: 'enemy', fx: 'melee',
      desc: 'Широкий удар: цель и соседи (50%).',
      run: (e, u, t) => {
        const n = e.hit(u, t!, 1.3);
        if (n > 0 && N(u, 'A2') && t!.alive) e.add(t!, 'bleed', 3, Math.round(u.atk * 0.3));
        if (n > 0 && N(u, 'A3') && t!.alive && !t!.boss && e.rnd() < 0.25) e.add(t!, 'stun', 1, 1);
        const splash = N(u, 'A5') ? e.enemies().filter((x) => x !== t) : e.adj(t!);
        for (const x of splash) e.hit(u, x, 1.3 * (N(u, 'A1') ? 0.7 : 0.5), { single: false });
      },
    },
    {
      id: 'g_cannon', name: 'Ручная пушка', label: 'Пушка', icon: 'icons/cannon', kind: 'skill', target: 'enemy', cost: 2, cd: 3, fx: 'shot',
      desc: 'Выстрел из протеза с оглушением на ход. Перезарядка 3 хода.',
      run: (e, u, t) => {
        if (N(u, 'C1')) u.cd.g_cannon = 3;
        const n = e.hit(u, t!, 2.0, { type: 'fire' });
        if (n > 0 && t!.alive) e.add(t!, 'stun', 1, 1);
        if (N(u, 'C3')) for (const x of e.adj(t!)) e.hit(u, x, 1.0, { type: 'fire', single: false });
      },
    },
    {
      id: 'g_knives', name: 'Метательные ножи', label: 'Ножи', icon: 'icons/knives', kind: 'skill', target: 'allEnemies', cost: 1, fx: 'shot',
      desc: '3 ножа по случайным врагам.',
      run: (e, u) => {
        for (const x of e.randFoes(u, N(u, 'C4') ? 5 : 3)) {
          const n = e.hit(u, x, 0.6, { single: false });
          if (n > 0 && N(u, 'C2') && x.alive) e.add(x, 'bleed', 3, Math.round(u.atk * 0.2));
        }
      },
    },
    {
      id: 'g_ult', name: 'Доспех берсерка', label: 'Доспех', icon: 'icons/berserk', kind: 'ult', target: 'self', fx: 'buff',
      desc: '3 хода не падает, +50% урона, не оглушается. Потом теряет 20% здоровья и пропускает ход.',
      run: (e, u) => { const t = N(u, 'B4') ? 4 : 3; e.add(u, 'berserk', t, 50); e.add(u, 'deathless', t, 1); },
    },
  ],
  hooks: {
    battleStart: (_e, u) => { u.res.rage = 0; u.res.fighter = N(u, 'B3') ? 2 : 1; },
    dealMult: (e, u, t) => {
      let m = 1;
      if (e.has(u, 'berserk')) m += 0.5;
      if (u.hp < u.maxHp * 0.3) m += 0.3;
      if (N(u, 'A4')) m += 0.02 * (u.res.rage ?? 0);
      if (e.team('hunters') && (t.tags.includes('demon') || t.tags.includes('undead'))) m += 0.15;
      return m;
    },
    onDamaged: (e, u) => { e.res(u, 'rage', 1, 20); },
    onKill: (e, u) => { if (N(u, 'B2')) e.heal(u, u.maxHp * 0.05); },
    onFatal: (_e, u) => { if ((u.res.fighter ?? 0) > 0) { u.res.fighter -= 1; return true; } return false; },
    onExpire: (e, u, st) => {
      if (st.id === 'berserk' && !N(u, 'B5')) {
        u.hp = Math.max(1, u.hp - Math.round(u.maxHp * 0.2));
        e.float(u, 'отдача доспеха', '#ff6a55');
        e.add(u, 'exhausted', 1, 1);
      }
    },
    onAfterAction: (e, u, ab) => {
      if (N(u, 'C5') && ab.kind === 'skill') {
        const t = e.randFoes(u, 1)[0];
        if (t) e.hit(u, t, 0.8, { type: 'fire', single: false });
      }
    },
    resLine: (_e, u) => `Ярость: ${u.res.rage ?? 0}`,
  },
});

// ===================== Старк =====================
hero({
  key: 'stark', name: 'Старк', nameAcc: 'Старка', role: 'tank', work: 'Фрирен', color: '#b5432f',
  hp: 125, atk: 14, def: 0.15, spd: 5, mp: 6, mpRegen: 2, mpName: 'Энергия',
  passive: 'Трус, но не сбежит: +1% урона за каждый потерянный % здоровья самого раненого союзника (до +60%). В первом раунде −20% урона.',
  mods: { A1: { atk: 0.1 }, A2: { crit: 0.15 } },
  tree: {
    A: ['Воин', [node('Сила', '+10% урона'), node('Точный удар', '+15% шанса крита'), node('Без передышки', '«Удар молнии» без перезарядки'), node('Сокрушительный', 'Крит ×2,5'), node('Сквозь броню', 'Удары игнорируют защиту')]],
    B: ['Защитник', [node('Стойкость', 'Прикрывая, получает на 30% меньше урона'), node('Щит товарищу', '«Встать на пути» даёт союзнику щит'), node('Долгая стража', 'Прикрывает 3 хода'), node('Забота', 'Прикрытый союзник восстанавливает 5% в ход'), node('Ради товарища', 'Когда падает союзник, Старк сразу ходит')]],
    C: ['Храбрость', [node('Решимость', 'Нет штрафа первого раунда'), node('Ярость защитника', 'Пассивка до +80%'), node('Не дрогнет', 'Не оглушается и не боится'), node('Рывок', 'Ускорение, когда у отряда меньше половины здоровья'), node('Я не убегу', 'Раз за бой, когда союзник ниже 25%, шкала Предела заполняется')]],
  },
  abilities: () => [
    { id: 's_axe', name: 'Удар топором', label: 'Топор', icon: I.sword, kind: 'basic', target: 'enemy', fx: 'melee', desc: 'Сильный удар топором.',
      run: (e, u, t) => { e.hit(u, t!, 1.2, starkO(u)); } },
    {
      id: 's_bolt', name: 'Удар молнии', label: 'Молния', icon: 'icons/s_bolt', kind: 'skill', target: 'enemy', cost: 3, cd: 2, fx: 'melee',
      desc: 'Мощный удар. +50%, если цель в этом раунде ранила союзника.',
      run: (e, u, t) => {
        if (N(u, 'A3')) u.cd.s_bolt = 0;
        e.hit(u, t!, 2.2 * (t!.res.hitHero === e.s.round ? 1.5 : 1), starkO(u));
      },
    },
    {
      id: 's_cover', name: 'Встать на пути', label: 'Прикрыть', icon: I.shield, kind: 'skill', target: 'self', cost: 2, fx: 'buff',
      desc: '2 хода принимает удары за самого раненого союзника.',
      run: (e, u) => {
        const w = mostWounded(e, u, u);
        if (!w) return;
        e.add(u, 'guarding', N(u, 'B3') ? 3 : 2, N(u, 'B1') ? 0.7 : 1, { wards: [w.uid], keep: true });
        if (N(u, 'B2')) e.add(w, 'shield', 99, Math.round(u.maxHp * 0.15));
        if (N(u, 'B4')) e.add(w, 'regen', 2, 5);
        e.float(w, 'под защитой Старка', '#fff3d6');
      },
    },
    {
      id: 's_ult', name: 'Расколоть небо', label: 'Ульта', icon: 'icons/s_ult', kind: 'ult', target: 'enemy', fx: 'melee',
      desc: 'Огромный удар. ×2, если кто-то из отряда ниже 25% здоровья.',
      run: (e, u, t) => {
        const low = e.alliesOf(u).some((x) => x.hp < x.maxHp * 0.25);
        e.hit(u, t!, 4.5 * (low ? 2 : 1), starkO(u));
      },
    },
  ],
  hooks: {
    dealMult: (e, u) => {
      const w = mostWounded(e, u, u);
      const miss = w ? 1 - w.hp / w.maxHp : 0;
      let m = 1 + Math.min(N(u, 'C2') ? 0.8 : 0.6, miss);
      if (e.s.round === 1 && !N(u, 'C1')) m *= 0.8;
      return m;
    },
    roundStart: (e, u) => {
      if (N(u, 'C4') && avgHp(e, u) < 0.5) e.add(u, 'haste', 1, 30);
      if (e.team('frieren2')) {
        const fern = e.byKey('fern');
        if (fern && !e.has(u, 'guarding')) e.add(u, 'guarding', 1, 1, { wards: [fern.uid] });
      }
    },
    onAnyDeath: (e, u, v) => { if (N(u, 'B5') && v.side === u.side && v !== u && u.alive) e.extraTurn(u); },
    onPartyDamaged: (e, u, v) => {
      if (N(u, 'C5') && !u.res.c5 && v !== u && v.hp < v.maxHp * 0.25) { u.res.c5 = 1; u.limit = 100; e.float(u, 'Я не убегу!', '#ffd75a'); }
    },
  },
});
function starkO(u: Unit): HitOpts { return { critMult: N(u, 'A4') ? 2.5 : 1.5, pierce: N(u, 'A5') ? 1 : 0 }; }

// ===================== Мелиодас =====================
hero({
  key: 'meliodas', name: 'Мелиодас', nameAcc: 'Мелиодаса', role: 'tank', work: 'Семь смертных грехов', color: '#f2d16b',
  hp: 120, atk: 13, def: 0.15, spd: 6, mp: 6, mpRegen: 2, mpName: 'Энергия',
  passive: 'Метка демона: ниже 50% здоровья +30% урона. Гнев копит весь урон по отряду — для ульты.',
  tree: {
    A: ['Полный контрудар', [node('Возврат ×2,5', 'Отражает заклинания ×2,5'), node('Против клинков', 'Контрудар ещё и отвечает на удары оружием'), node('Гнев в ответ', 'Отражение даёт Гнев'), node('Мгновенная реакция', 'Раз в 3 раунда контрудар не тратит ход'), node('Абсолютный контрудар', 'Отражает все заклинания до конца хода')]],
    B: ['Лоствейн', [node('Три копии', '3 копии вместо 2'), node('Крепкие копии', 'Копии бьют на 70%'), node('Копия-щит', 'Раз за раунд копия принимает удар за союзника'), node('Долгие копии', 'Копии живут 3 хода'), node('Армия Лоствейна', '4 копии, бьют случайных врагов')]],
    C: ['Сила демона', [node('Раннее пробуждение', 'Метка уже с 60% здоровья'), node('Адское пламя', 'Удар Лоствейном поджигает'), node('Регенерация демона', '+5% здоровья в начале хода'), node('Глубже в метку', 'Метка даёт +45%'), node('Режим ярости', 'После ульты 2 хода +100% урона')]],
  },
  abilities: (_e, u): AbilityDef[] => [
    {
      id: 'm_slash', name: 'Лоствейн', label: 'Меч', icon: I.sword, kind: 'basic', target: 'enemy', fx: 'melee',
      desc: 'Удар мечом; копии повторяют его.',
      run: (e, u, t) => {
        const dark = mark(u) ? 'dark' : 'phys';
        const n = e.hit(u, t!, 1.2, { type: dark });
        if (n > 0 && N(u, 'C2') && t!.alive) e.add(t!, 'burn', 3, Math.round(u.atk * 0.3));
        const k = e.val(u, 'clones');
        for (let i = 0; i < k; i++) {
          const x = N(u, 'B5') ? e.randFoes(u, 1)[0] : t!.alive ? t! : e.randFoes(u, 1)[0];
          if (x) e.hit(u, x, 1.2 * (N(u, 'B2') ? 0.7 : 0.5), { type: dark, single: false, sure: true });
        }
      },
    },
    {
      id: 'm_counter', name: 'Полный контрудар', label: 'Контр', icon: 'icons/counter', kind: 'skill', target: 'self', cost: 2, fx: 'buff',
      desc: 'До своего хода отражает заклинания с уроном ×2.',
      run: (e, u) => {
        e.add(u, 'reflectMagic', 1, N(u, 'A1') ? 2.5 : 2, { keep: N(u, 'A5') });
        if (N(u, 'A2')) e.add(u, 'counter', 1, 1);
        if (N(u, 'A4') && e.s.round - (u.res.a4 ?? -9) >= 3) { u.res.a4 = e.s.round; e.extraTurn(u); }
      },
    },
    {
      id: 'm_clones', name: 'Лоствейн: копии', label: 'Копии', icon: 'icons/clones', kind: 'skill', target: 'self', cost: 3, fx: 'buff',
      desc: '2 копии на 2 хода повторяют удары с 50% урона.',
      run: (e, u) => e.add(u, 'clones', N(u, 'B4') ? 3 : 2, N(u, 'B5') ? 4 : N(u, 'B1') ? 3 : 2),
    },
    {
      id: 'm_ult', name: 'Ответный удар мести', label: 'Месть', icon: 'icons/revenge', kind: 'ult', target: 'enemy', fx: 'melee',
      desc: `Возвращает врагу накопленный Гнев (сейчас ${Math.round(Math.max(u.res.wrath ?? 0, u.atk * 3))}).`,
      run: (e, u, t) => {
        const p = Math.min(u.atk * 12, Math.max(u.res.wrath ?? 0, u.atk * 3));
        e.hit(u, t!, p, { flat: true, sure: true, type: 'dark' });
        u.res.wrath = 0;
        if (N(u, 'C5')) e.add(u, 'assault', 2, 1);
      },
    },
  ],
  hooks: {
    dealMult: (e, u) => (mark(u) ? (N(u, 'C4') ? 1.45 : 1.3) : 1) * (e.team('sins3') ? 1.15 : 1),
    onPartyDamaged: (e, u, _v, n) => { e.res(u, 'wrath', n, u.atk * 12); },
    turnStart: (e, u) => { if (N(u, 'C3')) e.heal(u, u.maxHp * 0.05, true); },
    resLine: (_e, u) => `Гнев: ${Math.round(u.res.wrath ?? 0)}`,
  },
});
function mark(u: Unit): boolean { return u.hp < u.maxHp * (N(u, 'C1') ? 0.6 : 0.5); }

// ===================== Аста =====================
hero({
  key: 'asta', name: 'Аста', nameAcc: 'Асту', role: 'fighter', work: 'Чёрный клевер', color: '#6b7a8f',
  hp: 115, atk: 13, def: 0.1, spd: 6, mp: 5, mpRegen: 0, mpName: 'Антимагия',
  passive: 'Без магии: магический урон по нему ×0,5, тишина не действует. Антимагия +1, когда враг колдует.',
  tree: {
    A: ['Меч Убийцы Демонов', [node('Двойное рассеивание', 'Удар снимает 2 эффекта'), node('По щитам', 'Удар игнорирует щит цели и бьёт ×1,5 по защищённым'), node('Разрез', 'Удар снимает щиты со всех врагов'), node('Трофей', '+10% урона за каждый снятый бафф (2 хода)'), node('Чёрный рассекатель', 'Удар бьёт всех врагов и снимает их баффы')]],
    B: ['Меч Обитателя Демонов', [node('Подпитка', 'Поглощение лечит Асту на 10%'), node('Заслон', 'Поглощает заклинания по любому союзнику'), node('Возврат ×1,5', 'Возвращает поглощённое ×1,5'), node('Заряд', '+2 Антимагии за поглощение'), node('Встречный удар', 'Возврат бьёт всех врагов')]],
    C: ['Меч Разрушителя Демонов', [node('Щит после очищения', 'Очищенный получает щит'), node('Очищение отряда', 'Очищает весь отряд'), node('Антимагия', 'Очищенный неуязвим для магии на ход'), node('Лёгкость', 'Очищенный ускоряется на 2 хода'), node('Разрушитель', 'В начале раунда очищает союзника; удар снимает с врагов бессмертие')]],
  },
  abilities: () => [
    {
      id: 'a_slayer', name: 'Меч Убийцы Демонов', label: 'Убийца', icon: I.sword, kind: 'basic', target: 'enemy', fx: 'melee',
      desc: 'Удар, снимающий баффы цели.',
      run: (e, u, t) => {
        const targets = N(u, 'A5') ? e.enemies() : [t!];
        let removed = 0;
        for (const x of targets) {
          const sh = e.has(x, 'shield');
          e.hit(u, x, (x === t ? 1.2 : 0.7) * (N(u, 'A2') && sh ? 1.5 : 1), { ignoreShield: N(u, 'A2'), single: x === t });
          if (!x.alive) continue;
          removed += e.dispel(x, e.has(u, 'blackForm') || N(u, 'A5') ? 99 : N(u, 'A1') ? 2 : 1);
          if (N(u, 'C5')) { e.del(x, 'undying'); e.del(x, 'regen'); }
        }
        if (N(u, 'A3')) for (const x of e.enemies()) e.del(x, 'shield');
        if (N(u, 'A4') && removed) e.add(u, 'atkUp', 2, Math.min(50, 10 * removed));
      },
    },
    {
      id: 'a_dweller', name: 'Меч Обитателя Демонов', label: 'Обитатель', icon: 'icons/dweller', kind: 'skill', target: 'self', cost: 1, fx: 'buff',
      desc: 'До своего хода поглощает заклинание и возвращает его автору.',
      run: (e, u) => e.add(u, 'absorbMagic', 1, N(u, 'B3') ? 1.5 : 1, { party: N(u, 'B2'), all: N(u, 'B5') }),
    },
    {
      id: 'a_destroyer', name: 'Меч Разрушителя Демонов', label: 'Разрушитель', icon: 'icons/destroyer', kind: 'skill', target: 'ally', cost: 1, fx: 'buff',
      desc: 'Снимает с союзника все негативные эффекты.',
      run: (e, u, t) => {
        for (const x of N(u, 'C2') ? e.alliesOf(u) : [t!]) {
          e.cleanse(x);
          if (N(u, 'C1')) e.add(x, 'shield', 99, Math.round(u.maxHp * 0.15));
          if (N(u, 'C3')) e.add(x, 'absorbMagic', 1, 0);
          if (N(u, 'C4')) e.add(x, 'haste', 2, 30);
        }
      },
    },
    {
      id: 'a_ult', name: 'Чёрная форма', label: 'Чёрная', icon: 'icons/blackform', kind: 'ult', target: 'self', fx: 'buff',
      desc: '3 хода каждый удар снимает все баффы, +30% урона, магия по отряду −50%.',
      run: (e, u) => e.add(u, 'blackForm', 3, 30),
    },
  ],
  hooks: {
    battleStart: (_e, u) => { u.mp = 2; },
    takenMult: (_e, _u, _s, o) => (o.magic ? 0.5 : 1),
    allyTakenMult: (e, u, _a, _s, o) => (o.magic && e.has(u, 'blackForm') ? 0.5 : 1),
    dealMult: (e, u) => 1 + (e.has(u, 'blackForm') ? 0.3 : 0),
    onEnemyAction: (e, u) => { e.mp(u, 1); },
    onDamaged: (e, u, _s, _n, o) => {
      if (o.tag === 'absorbed') {
        if (N(u, 'B1')) e.heal(u, u.maxHp * 0.1, true);
        e.mp(u, N(u, 'B4') ? 2 : 1);
      } else if (o.magic) e.mp(u, 1);
    },
    roundStart: (e, u) => {
      if (!N(u, 'C5')) return;
      const x = e.alliesOf(u).find((a) => a.statuses.some((s) => ['burn', 'bleed', 'poison', 'stun', 'slow', 'fear', 'silence', 'atkDown', 'doom', 'charm'].includes(s.id)));
      if (x) { e.cleanse(x); e.float(x, 'очищен', '#d0d0d0'); }
    },
  },
});

// ===================== Зоро =====================
function zhit(e: Engine, u: Unit, t: Unit, p: number, o: HitOpts = {}): number {
  u.res.hits = (u.res.hits ?? 0) + 1;
  const every = N(u, 'A2') ? 2 : 3;
  const crit = u.res.hits % every === 0;
  const pierce = N(u, 'B5') ? 1 : N(u, 'B4') ? 0.5 : N(u, 'B1') ? 0.25 : 0;
  const n = e.hit(u, t, p, {
    crit: crit ? 1 : 0, critMult: N(u, 'A3') ? 2.5 : 1.5, pierce: Math.max(pierce, o.pierce ?? 0),
    ignoreShield: N(u, 'B2') || N(u, 'B5'), lifesteal: N(u, 'C2') ? 0.1 : 0, ...o,
  });
  if (n > 0 && crit && (N(u, 'A4') || o.tag === 'oni') && t.alive) e.add(t, 'bleed', 3, Math.round(u.atk * 0.3));
  return n;
}
hero({
  key: 'zoro', name: 'Зоро', nameAcc: 'Зоро', role: 'fighter', work: 'Ван-Пис', color: '#3fa34d',
  hp: 110, atk: 11, def: 0.1, spd: 6, mp: 6, mpRegen: 2, mpName: 'Энергия', crit: 0.05,
  passive: 'Санторю: каждый третий удар — крит.',
  mods: { C1: { atk: 0.2 } },
  tree: {
    A: ['Санторю', [node('Четыре удара', '«Они гири» бьёт 4 раза'), node('Ритм', 'Крит каждый второй удар'), node('Глубокий порез', 'Крит ×2,5'), node('Кровь за кровь', 'Каждый крит вызывает кровотечение'), node('Финальный взмах', '«Они гири» заканчивается ударом по всем врагам')]],
    B: ['Путь меча', [node('Пробитие', 'Удары пробивают 25% брони'), node('Режет щиты', 'Удары игнорируют щиты'), node('Не останавливаясь', 'Убийство даёт ещё удар по случайному врагу'), node('Пробитие II', 'Пробивают 50% брони'), node('Рассечь сталь', 'Игнорирует броню и щиты полностью')]],
    C: ['Энма', [node('Жадный клинок', '+20% урона, каждое действие стоит 3% здоровья'), node('Кровопийца', 'Вампиризм 10%'), node('На грани', 'Ниже 30% здоровья +40% урона'), node('Двенадцать', '«Асура» бьёт 12 раз'), node('Король ада', 'Ульта ×2, после неё ход без сил')]],
  },
  abilities: () => [
    { id: 'z_two', name: 'Два меча', label: 'Мечи', icon: I.sword, kind: 'basic', target: 'enemy', fx: 'melee', desc: 'Два удара по цели.',
      run: (e, u, t) => { zhit(e, u, t!, 0.65); if (t!.alive) zhit(e, u, t!, 0.65); } },
    {
      id: 'z_oni', name: 'Они гири', label: 'Они гири', icon: 'icons/oni', kind: 'skill', target: 'enemy', cost: 2, fx: 'melee',
      desc: '3 удара; крит вызывает кровотечение.',
      run: (e, u, t) => {
        for (let i = 0; i < (N(u, 'A1') ? 4 : 3); i++) {
          const x = t!.alive ? t! : e.randFoes(u, 1)[0];
          if (x) zhit(e, u, x, 0.7, { tag: 'oni' });
        }
        if (N(u, 'A5')) for (const x of e.enemies()) zhit(e, u, x, 0.5, { single: false });
      },
    },
    { id: 'z_36', name: '36 фунтов феникс', label: 'Феникс', icon: 'icons/phoenix36', kind: 'skill', target: 'enemyAny', cost: 2, fx: 'shot',
      desc: 'Летящий разрез по любой цели, пробивает 50% брони.', run: (e, u, t) => { zhit(e, u, t!, 1.6, { pierce: 0.5 }); } },
    {
      id: 'z_ult', name: 'Асура', label: 'Асура', icon: 'icons/asura', kind: 'ult', target: 'allEnemies', fx: 'aoe',
      desc: '9 ударов по случайным врагам.',
      run: (e, u) => {
        for (const x of e.randFoes(u, N(u, 'C4') ? 12 : 9)) zhit(e, u, x, 0.6 * (N(u, 'C5') ? 2 : 1), { single: false });
        if (N(u, 'C5')) e.add(u, 'exhausted', 1, 1);
      },
    },
  ],
  hooks: {
    dealMult: (e, u) => {
      let m = 1;
      if (N(u, 'C3') && u.hp < u.maxHp * 0.3) m += 0.4;
      if (e.team('mugi2')) m += 0.1;
      if (e.team('mugi3')) m += (u.res.rival ?? 0) / 100;
      return m;
    },
    onDealt: (e) => { if (e.team('mugi3')) { const s = e.byKey('sanji'); if (s) e.res(s, 'rival', 2, 50); } },
    onKill: (e, u) => {
      if (N(u, 'B3') && !u.res.b3) { u.res.b3 = 1; const t = e.randFoes(u, 1)[0]; if (t) zhit(e, u, t, 1.0, { single: false }); u.res.b3 = 0; }
    },
    onAfterAction: (e, u) => { if (N(u, 'C1')) u.hp = Math.max(1, u.hp - Math.round(u.maxHp * 0.03)); void e; },
  },
});

// ===================== Луффи =====================
function luffyPunch(e: Engine, u: Unit, t: Unit, p: number, single = true): void {
  let k = 1;
  const g3 = e.has(u, 'gear3');
  if (g3) { k = 2.5; e.del(u, 'gear3'); }
  const targets = e.has(u, 'gear5') || (g3 && N(u, 'B5')) ? e.enemies() : [t];
  for (const x of targets) {
    const n = e.hit(u, x, p * k, { haki: g3 && N(u, 'B3'), pierce: g3 && N(u, 'B3') ? 0.5 : 0, single: single && x === t });
    if (g3 && n > 0 && N(u, 'B2') && x.alive && !x.boss) e.add(x, 'stun', 1, 1);
    if (g3 && N(u, 'B4')) for (const y of e.adj(x)) e.hit(u, y, p * k * 0.5, { single: false });
  }
}
hero({
  key: 'luffy', name: 'Луффи', nameAcc: 'Луффи', role: 'fighter', work: 'Ван-Пис', color: '#d93a2b',
  hp: 120, atk: 12, def: 0.1, spd: 7, mp: 6, mpRegen: 2, mpName: 'Энергия', resist: { lightning: 0 },
  passive: 'Резина: молния не действует, физический урон −15%.',
  tree: {
    A: ['Гир 2', [node('Без перегрева', 'Гир 2 не отнимает здоровье'), node('Чаще', 'В Гир 2 доп. ход каждое второе действие'), node('Гатлинг ×8', '«Гатлинг» бьёт 8 раз'), node('Лёгкость', 'В Гир 2 +20% уклонения'), node('Джет-гатлинг', '«Гатлинг» бьёт 12 раз')]],
    B: ['Гир 3', [node('Гир 3', 'Открывает Гир 3: следующий удар ×2,5'), node('Оглушение', 'Удар в Гир 3 оглушает'), node('Хаки вооружения', 'Удар в Гир 3 пробивает броню и логию'), node('Великан', 'Удар в Гир 3 задевает соседей'), node('Гризли магнум', 'Удар в Гир 3 бьёт всех')]],
    C: ['Гир 4', [node('Гир 4', 'Открывает Гир 4: 3 хода +80%, потом 2 хода без сил'), node('Выносливость', 'После Гир 4 — 1 ход без сил'), node('Баунсмен', 'Гир 4 даёт +100%'), node('Дольше', 'Гир 4 держится 4 хода'), node('Кинг-Конг', 'В Гир 4: колоссальный удар ×5 раз за режим')]],
  },
  abilities: (e, u) => {
    const l = [
      { id: 'l_pistol', name: 'Гому-гому но Пистолет', label: 'Пистолет', icon: I.sword, kind: 'basic' as const, target: 'enemy' as const, fx: 'melee' as const,
        desc: 'Удар резиновым кулаком.', run: (e2: Engine, u2: Unit, t: Unit | null) => luffyPunch(e2, u2, t!, 1.1) },
      {
        id: 'l_gatling', name: 'Гатлинг', label: 'Гатлинг', icon: 'icons/gatling', kind: 'skill' as const, target: 'allEnemies' as const, cost: 2, fx: 'melee' as const,
        desc: '5 ударов по случайным врагам.',
        run: (e2: Engine, u2: Unit) => {
          const n = N(u2, 'A5') ? 12 : N(u2, 'A3') ? 8 : 5;
          for (const x of e2.has(u2, 'gear5') ? e2.enemies().flatMap((y) => [y, y]) : e2.randFoes(u2, n)) e2.hit(u2, x, 0.4, { single: false });
        },
      },
      {
        id: 'l_gear2', name: 'Гир 2', label: 'Гир 2', icon: 'icons/gear2', kind: 'skill' as const, target: 'self' as const, cost: 2, fx: 'buff' as const,
        desc: '3 хода +50% скорости, каждое третье действие — ещё ход.',
        run: (e2: Engine, u2: Unit) => {
          e2.add(u2, 'gear2', 3, 50); e2.add(u2, 'haste', 3, 50);
          if (N(u2, 'A4')) e2.add(u2, 'dodgeUp', 3, 20);
        },
      },
    ] as ReturnType<typeof e.abilities>;
    if (N(u, 'B1')) l.push({ id: 'l_gear3', name: 'Гир 3', label: 'Гир 3', icon: 'icons/gear3', kind: 'skill', target: 'self', cost: 2, fx: 'buff',
      desc: 'Следующий удар ×2,5.', run: (e2, u2) => e2.add(u2, 'gear3', 99, 1) });
    if (N(u, 'C1')) {
      if (N(u, 'C5') && e.has(u, 'gear4') && !u.res.kong) {
        l.push({ id: 'l_kong', name: 'Кинг-Конг Ган', label: 'Кинг-Конг', icon: 'icons/kong', kind: 'skill', target: 'enemy', fx: 'melee',
          desc: 'Колоссальный удар ×5.', run: (e2, u2, t) => { u2.res.kong = 1; e2.hit(u2, t!, 5, { haki: true }); } });
      } else {
        l.push({ id: 'l_gear4', name: 'Гир 4', label: 'Гир 4', icon: 'icons/gear4', kind: 'skill', target: 'self', cost: 3, fx: 'buff',
          desc: '3 хода +80% урона, потом 2 хода без сил.',
          check: (e2, u2) => (e2.has(u2, 'gear4') ? 'Гир 4 уже включён.' : null),
          run: (e2, u2) => { u2.res.kong = 0; e2.add(u2, 'gear4', N(u2, 'C4') ? 4 : 3, N(u2, 'C3') ? 100 : 80); } });
      }
    }
    l.push({ id: 'l_ult', name: 'Гир 5', label: 'Гир 5', icon: 'icons/gear5', kind: 'ult', target: 'self', fx: 'buff',
      desc: '3 хода удары бьют всех врагов, снимает весь негатив; потом ход без сил.',
      run: (e2, u2) => { e2.cleanse(u2); e2.add(u2, 'gear5', 3, 1); } });
    return l;
  },
  hooks: {
    takenMult: (_e, _u, _s, o) => ((o.type ?? 'phys') === 'phys' ? 0.85 : 1),
    dealMult: (e, u) => 1 + e.val(u, 'gear4') / 100 + (e.team('mugi2') ? 0.1 : 0),
    turnStart: (e, u) => { if (e.has(u, 'gear2') && !N(u, 'A1')) u.hp = Math.max(1, u.hp - Math.round(u.maxHp * 0.03)); },
    onAfterAction: (e, u, ab) => {
      if (e.has(u, 'gear2') && ab.id !== 'l_gear2') {
        u.res.g2 = (u.res.g2 ?? 0) + 1;
        if (u.res.g2 % (N(u, 'A2') ? 2 : 3) === 0) e.extraTurn(u);
      }
    },
    onExpire: (e, u, st) => {
      if (st.id === 'gear4') e.add(u, 'exhausted', N(u, 'C2') ? 1 : 2, 1);
      if (st.id === 'gear5') e.add(u, 'exhausted', 1, 1);
    },
  },
});

// ===================== Санджи =====================
function sanjiTargets(e: Engine, u: Unit): Unit[] {
  const foes = e.foesOf(u).filter((x) => e.targetable(x) && !x.tags.includes('female'));
  const taunt = foes.filter((x) => e.has(x, 'taunt'));
  return taunt.length ? taunt : foes;
}
const sanjiCheck = (e: Engine, u: Unit) => (sanjiTargets(e, u).length ? null : 'Кодекс рыцаря: Санджи не бьёт женщин.');
hero({
  key: 'sanji', name: 'Санджи', nameAcc: 'Санджи', role: 'fighter', work: 'Ван-Пис', color: '#e3c13b',
  hp: 105, atk: 12, def: 0.1, spd: 8, mp: 6, mpRegen: 2, mpName: 'Энергия', dodge: 0.1,
  passive: 'Кодекс рыцаря: не бьёт врагов-женщин, но получает от них −30% урона.',
  mods: { C1: { dodge: 0.15 }, C4: { dodge: 0.1 } },
  tree: {
    A: ['Чёрная нога', [node('Жар', 'Горение сильнее'), node('Конкассе', '«Диабль Жамб» ×2 по оглушённым и замороженным'), node('Пламя', 'Огонь задевает соседей'), node('Раскалённый', 'Удары огнём быстрее копят ульту'), node('Всегда в огне', 'Обычный удар тоже огненный и поджигает')]],
    B: ['Повар', [node('Сытнее', 'Обед лечит 20%'), node('Свежие продукты', 'Обед снимает яд, горение и кровотечение'), node('Энергия', 'Сытость даёт +15% урона'), node('Перекус', 'Обед восстанавливает 2 энергии всем'), node('Банкет', 'Первый обед в бою: +20% урона и защиты отряду на 3 хода')]],
    C: ['Небесный шаг', [node('Лёгкие ноги', '+15% уклонения'), node('Ответ ногой', 'Уклонившись, контратакует'), node('Небесная походка', 'Раз за бой при ОЗ ниже 40% недосягаем ход'), node('Ещё легче', '+10% уклонения'), node('Рейд-сьют', 'Начинает бой невидимым на 2 хода; удар из невидимости ×2')]],
  },
  abilities: () => [
    {
      id: 'sj_kick', name: 'Удар ногой', label: 'Пинок', icon: I.sword, kind: 'basic', target: 'enemy', fx: 'melee', desc: 'Удар ногой.',
      targets: sanjiTargets, check: sanjiCheck,
      run: (e, u, t) => {
        const n = e.hit(u, t!, 1.1, { type: N(u, 'A5') ? 'fire' : 'phys' });
        if (n > 0 && N(u, 'A5') && t!.alive) e.add(t!, 'burn', 3, Math.round(u.atk * 0.2));
      },
    },
    {
      id: 'sj_diable', name: 'Диабль Жамб', label: 'Диабль', icon: I.fire, kind: 'skill', target: 'enemy', cost: 2, fx: 'melee',
      desc: 'Огненный удар с горением на 3 хода.', targets: sanjiTargets, check: sanjiCheck,
      run: (e, u, t) => {
        const k = N(u, 'A2') && (e.has(t!, 'stun') || e.has(t!, 'freeze')) ? 2 : 1;
        const n = e.hit(u, t!, 1.6 * k, { type: 'fire' });
        if (n > 0 && t!.alive) e.add(t!, 'burn', 3, Math.round(u.atk * (N(u, 'A1') ? 0.45 : 0.3)));
        if (N(u, 'A3')) for (const x of e.adj(t!)) if (!x.tags.includes('female')) e.hit(u, x, 0.8, { type: 'fire', single: false });
      },
    },
    {
      id: 'sj_meal', name: 'Обед на всех', label: 'Обед', icon: I.potion, kind: 'skill', target: 'allAllies', cost: 3, fx: 'heal',
      desc: 'Лечит отряд на 15% и даёт Сытость (+5% здоровья в ход, 3 хода).',
      run: (e, u) => {
        const k = e.team('cooks') ? 1.5 : 1;
        for (const x of e.alliesOf(u)) {
          const extra = e.team('mugi3') && x.key === 'luffy' ? 2 : 1;
          e.heal(x, x.maxHp * (N(u, 'B1') ? 0.2 : 0.15) * k * extra);
          e.add(x, 'fed', 3, 1); e.add(x, 'regen', 3, 5);
          if (N(u, 'B2')) e.cleanse(x, ['burn', 'bleed', 'poison']);
          if (N(u, 'B3')) e.add(x, 'atkUp', 3, 15);
          if (N(u, 'B4')) e.mp(x, 2);
          if (N(u, 'B5') && !u.res.banquet) { e.add(x, 'atkUp', 3, 20); e.add(x, 'defUp', 3, 20); }
        }
        u.res.banquet = 1;
      },
    },
    {
      id: 'sj_ult', name: 'Ифрит Жамб', label: 'Ифрит', icon: 'icons/ifrit', kind: 'ult', target: 'allEnemies', fx: 'aoe',
      desc: 'Огненный удар по всем врагам с сильным горением.',
      run: (e, u) => {
        for (const x of e.enemies()) {
          if (x.tags.includes('female')) continue;
          const n = e.hit(u, x, 2.5, { type: 'fire', single: false });
          if (n > 0 && x.alive) e.add(x, 'burn', 3, Math.round(u.atk * 0.5));
        }
      },
    },
  ],
  hooks: {
    battleStart: (e, u) => { if (N(u, 'C5')) { e.add(u, 'invisible', 2, 1); u.res.c5 = 1; } },
    takenMult: (_e, _u, src) => (src.tags.includes('female') ? 0.7 : 1),
    dealMult: (e, u) => {
      let m = 1 + (e.team('mugi2') ? 0.1 : 0) + (e.team('mugi3') ? (u.res.rival ?? 0) / 100 : 0);
      if (u.res.c5 && e.has(u, 'invisible')) { m *= 2; u.res.c5 = 0; e.del(u, 'invisible'); }
      return m;
    },
    onDealt: (e, u, _t, _n, o) => {
      if (N(u, 'A4') && o.type === 'fire') e.limit(u, 4);
      if (e.team('mugi3')) { const z = e.byKey('zoro'); if (z) e.res(z, 'rival', 2, 50); }
    },
    onDodge: (e, u, a) => { if (N(u, 'C2') && a.alive) e.hit(u, a, 0.8, { counter: true, sure: true, single: true }); },
    onDamaged: (e, u) => {
      if (N(u, 'C3') && !u.res.c3 && u.hp < u.maxHp * 0.4 && u.alive) { u.res.c3 = 1; e.add(u, 'invisible', 1, 1); e.float(u, 'Небесная походка', '#e8e8ff'); }
    },
  },
});

// ===================== Эсканор =====================
function sunCalc(e: Engine, u: Unit): number {
  const start = N(u, 'A5') ? 1.2 : N(u, 'A1') ? 0.7 : 0.5;
  const grow = N(u, 'A2') ? 0.5 : 0.4;
  const noon = N(u, 'A3') ? 5 : 6;
  const peak = N(u, 'B4') ? 3.0 : N(u, 'B1') ? 2.8 : 2.5;
  const fall = N(u, 'C3') ? 0.15 : N(u, 'C1') ? 0.2 : 0.3;
  const min = N(u, 'C2') ? 1.0 : 0.7;
  const win = N(u, 'B5') ? 3 : N(u, 'B3') ? 2 : 1;
  const r = e.s.round;
  let s: number;
  if (r < noon) s = Math.min(peak, start + grow * (r - 1));
  else if (r < noon + win) s = peak;
  else s = Math.max(min, peak - fall * (r - noon - win + 1));
  u.res.noon = r >= noon && r < noon + win ? 1 : 0;
  u.res.afterNoon = r >= noon + win ? 1 : 0;
  s += (e.team('sins3') ? 0.3 : 0) + (u.res.kamina ?? 0) - (u.res.penalty ?? 0) + (u.res.burnLife ?? 0);
  return Math.max(0.3, Math.round(s * 10) / 10);
}
hero({
  key: 'escanor', name: 'Эсканор', nameAcc: 'Эсканора', role: 'fighter', work: 'Семь смертных грехов', color: '#f08a24',
  hp: 125, atk: 12, def: 0.15, spd: 3, mp: 6, mpRegen: 2, mpName: 'Энергия',
  passive: 'Солнце: сила ×0,5 в первом раунде, растёт до ×2,5 к полудню (6-й раунд), потом слабеет.',
  tree: {
    A: ['Рассвет', [node('Утро', 'Старт с ×0,7'), node('Быстрый рост', '+0,5 Солнца за раунд'), node('Ранний полдень', 'Полдень в 5-м раунде'), node('Хозяин бара', '«Бармен» лечит вдвое'), node('Ранний восход', 'Старт с ×1,2')]],
    B: ['Полдень', [node('Ярче', 'Пик ×2,8'), node('Высокомерие', '«Гордыня» снижает урон на 45%'), node('Долгий полдень', 'Пик держится 2 раунда'), node('Солнце в зените', 'Пик ×3,0'), node('Солнце не заходит', 'Пик держится 3 раунда')]],
    C: ['Закат', [node('Медленный закат', 'Падение −0,2 за раунд'), node('Остаток света', 'Не ниже ×1,0'), node('Длинный вечер', 'Падение −0,15 за раунд'), node('Сгорающая жизнь', 'После полудня платит 10% здоровья за +0,5 Солнца'), node('Последний свет', 'Падая, бьёт «Единственным» по всем')]],
  },
  abilities: (e, u) => {
    const sun = u.res.sun ?? 0.5;
    const pride = sun >= 1.5;
    const bar = !pride && e.s.round <= 2;
    return [
      { id: 'e_rhitta', name: 'Удар Ритой', label: 'Рита', icon: I.sword, kind: 'basic', target: 'enemy', fx: 'melee',
        desc: `Удар топором × Солнце (сейчас ×${sun}).`, run: (e2, u2, t) => { e2.hit(u2, t!, 1.3); } },
      { id: 'e_cruel', name: 'Жестокое солнце', label: 'Солнце', icon: I.fire, kind: 'skill', target: 'allEnemies', cost: 3, magic: true, fx: 'aoe',
        desc: 'Огненный шар по всем врагам × Солнце.', run: (e2, u2) => { for (const x of e2.enemies()) e2.hit(u2, x, 1.0, { type: 'fire', magic: true, single: false }); } },
      bar
        ? { id: 'e_bar', name: 'Бармен', label: 'Бармен', icon: I.potion, kind: 'skill', target: 'ally', cost: 1, fx: 'heal',
          desc: 'Пока солнце низко, тихий Эсканор лечит союзника напитком.', run: (e2, u2, t) => { e2.heal(t!, t!.maxHp * (N(u2, 'A4') ? 0.3 : 0.15)); } }
        : { id: 'e_pride', name: 'Гордыня', label: 'Гордыня', icon: I.shield, kind: 'skill', target: 'self', cost: 2, fx: 'buff',
          desc: 'Провоцирует всех и получает меньше урона. Нужно Солнце от ×1,5.',
          check: () => (pride ? null : `Солнце ×${sun}: для Гордыни нужно ×1,5.`),
          run: (e2, u2) => { e2.add(u2, 'taunt', 2, 1); e2.add(u2, 'defUp', 2, N(u2, 'B2') ? 45 : 30); } },
      { id: 'e_ult', name: 'Единственный', label: 'Единств.', icon: 'icons/theone', kind: 'ult', target: 'enemy', fx: 'melee',
        desc: 'Только в полдень: сокрушительный удар. Потом Солнце −0,6.',
        check: (_e2, u2) => (u2.res.noon ? null : 'Только в полдень.'),
        run: (e2, u2, t) => { e2.hit(u2, t!, 6, { sure: true }); u2.res.penalty = (u2.res.penalty ?? 0) + 0.6; } },
    ];
  },
  hooks: {
    battleStart: (e, u) => { u.res.sun = sunCalc(e, u); },
    roundStart: (e, u) => {
      u.res.sun = sunCalc(e, u);
      if (N(u, 'C4') && u.res.afterNoon && u.hp > u.maxHp * 0.3) {
        u.hp -= Math.round(u.maxHp * 0.1);
        u.res.burnLife = (u.res.burnLife ?? 0) + 0.5;
        u.res.sun = sunCalc(e, u);
        e.float(u, 'сгорающая жизнь', '#ff9f1c');
      }
      e.float(u, `Солнце ×${u.res.sun}`, '#ffd75a');
    },
    dealMult: (_e, u) => u.res.sun ?? 1,
    onAnyDeath: (e, u, v) => {
      if (v === u && N(u, 'C5')) { e.say('Последний свет Эсканора!'); for (const x of e.enemies()) e.hit(u, x, 4, { sure: true, single: false }); }
    },
    resLine: (_e, u) => `Солнце ×${u.res.sun ?? 0.5}`,
  },
});

// ===================== Убийца гоблинов =====================
hero({
  key: 'gs', name: 'Убийца гоблинов', nameAcc: 'Убийцу гоблинов', role: 'fighter', work: 'Убийца гоблинов', color: '#8a8f99',
  hp: 110, atk: 12, def: 0.2, spd: 6, mp: 3, mpRegen: 0, mpName: 'Снаряжение',
  passive: 'Только гоблины: ×2 урона по гоблинам, против них ходит первым. Снаряжение (ловушки, бомбы) не восстанавливается в бою.',
  mods: { C1: { def: 0.1 }, C3: { mp: 1 }, C4: { dodge: 0.1 } },
  tree: {
    A: ['Охотник на гоблинов', [node('Опыт', '×2,5 по гоблинам'), node('Следующий', 'Убив гоблина, ходит ещё раз'), node('Страх гоблинов', 'Гоблины наносят ему −30% урона'), node('Истребитель', '×3 по гоблинам'), node('Ни один не уйдёт', 'Удар по гоблину задевает соседних гоблинов')]],
    B: ['Уловки', [node('Две ловушки', 'Ловушка ставит 2 заряда'), node('Мучная бомба', 'Новое умение: огонь по всем'), node('Дым', 'Ловушка ослепляет всех врагов на 2 хода'), node('Капкан', 'Ловушка оглушает на 2 хода'), node('Свиток врат', 'Раз за бой ульта без шкалы')]],
    C: ['Выживание', [node('Доспех', '+10% защиты'), node('Зелья', 'Зелья лечат его вдвое'), node('Запас', '+1 снаряжение'), node('Осторожность', '+10% уклонения'), node('Ветеран', 'Первый смертельный удар оставляет 1 ОЗ')]],
  },
  abilities: (_e, u) => {
    const l: ReturnType<Engine['abilities']> = [
      {
        id: 'gs_sword', name: 'Короткий меч', label: 'Меч', icon: I.sword, kind: 'basic', target: 'enemy', fx: 'melee', desc: 'Удар; ×2 по гоблинам.',
        run: (e, u2, t) => {
          const k = u2.res.weapon ? 1.3 : 1;
          u2.res.weapon = 0;
          e.hit(u2, t!, 1.2 * k);
          if (N(u2, 'A5') && t!.tags.includes('goblin')) for (const x of e.adj(t!)) if (x.tags.includes('goblin')) e.hit(u2, x, 0.85, { single: false });
        },
      },
      { id: 'gs_throw', name: 'Бросок оружия', label: 'Бросок', icon: 'icons/throw', kind: 'skill', target: 'enemyAny', cd: 2, fx: 'shot',
        desc: 'Бросок по любой цели, крит по шаманам и магам; следующий удар — подобранным оружием (×1,3).',
        run: (e, u2, t) => { e.hit(u2, t!, 1.4, { crit: t!.tags.includes('mage') ? 0.5 : 0 }); u2.res.weapon = 1; } },
      { id: 'gs_trap', name: 'Ловушка', label: 'Ловушка', icon: 'icons/trap', kind: 'skill', target: 'self', cost: 1, fx: 'buff',
        desc: 'Первый враг, начавший действие, ранен и оглушён.',
        run: (e, u2) => {
          const ex = e.s.field.find((f) => f.id === 'trap');
          const n = N(u2, 'B1') ? 2 : 1;
          if (ex) ex.value += n; else e.s.field.push({ id: 'trap', turns: 99, value: n, data: { src: u2.uid } });
          if (N(u2, 'B3')) for (const x of e.enemies()) e.add(x, 'accDown', 2, 20);
          e.float(u2, `ловушки: ${(ex?.value ?? n)}`, '#ffe14d');
        } },
    ];
    if (N(u, 'B2')) l.push({ id: 'gs_bomb', name: 'Мучная бомба', label: 'Мука', icon: I.fire, kind: 'skill', target: 'allEnemies', cost: 1, fx: 'aoe',
      desc: 'Взрыв муки: огонь по всем врагам.', run: (e, u2) => { for (const x of e.enemies()) e.hit(u2, x, 1.0, { type: 'fire', single: false, sure: true }); } });
    l.push({ id: 'gs_ult', name: 'Свиток врат', label: 'Свиток', icon: 'icons/gate', kind: 'ult', target: 'enemy', fx: 'shot',
      limit: N(u, 'B5') && !u.res.gate ? 0 : 100,
      desc: 'Столб воды из врат в море: огромный урон по цели и соседям.',
      run: (e, u2, t) => {
        u2.res.gate = 1;
        e.hit(u2, t!, 4, { type: 'water', sure: true });
        for (const x of e.adj(t!)) e.hit(u2, x, 2, { type: 'water', sure: true, single: false });
      } });
    return l;
  },
  hooks: {
    dealMult: (_e, u, t) => (t.tags.includes('goblin') ? (N(u, 'A4') ? 3 : N(u, 'A1') ? 2.5 : 2) : 1),
    takenMult: (_e, u, src) => (N(u, 'A3') && src.tags.includes('goblin') ? 0.7 : 1),
    onKill: (e, u, v) => { if (N(u, 'A2') && v.tags.includes('goblin') && e.s.cur === u.uid) e.extraTurn(u); },
    onFatal: (_e, u) => { if (N(u, 'C5') && !u.res.vet) { u.res.vet = 1; return true; } return false; },
  },
});

// ===================== Бан =====================
function banSteal(e: Engine, u: Unit, x: Unit, v: number): void {
  e.add(x, 'atkDown', 3, v);
  const cur = e.val(u, 'atkUp');
  e.del(u, 'atkUp');
  e.add(u, 'atkUp', 3, Math.min(60, cur + v));
}
hero({
  key: 'ban', name: 'Бан', nameAcc: 'Бана', role: 'fighter', work: 'Семь смертных грехов', color: '#c9ccd6',
  hp: 105, atk: 11, def: 0.1, spd: 8, mp: 6, mpRegen: 2, mpName: 'Энергия',
  passive: 'Источник молодости: +5% здоровья в ход; раз за бой, упав, встаёт на своём ходу с 25%.',
  tree: {
    A: ['Снэтч', [node('Хватка', 'Крадёт 20% силы'), node('Чужой бафф', 'Снэтч снимает бафф цели'), node('Скорость', 'Снэтч крадёт и скорость'), node('Делёж', 'Украденную силу получает и самый слабый союзник'), node('Снэтч всего', 'Снэтч бьёт всех врагов')]],
    B: ['Бессмертие', [node('Источник', 'Восстанавливает 8% в ход'), node('Быстро встаёт', 'Встаёт с 40%'), node('Дважды', 'Встаёт 2 раза за бой'), node('Злой', 'Встав, провоцирует всех на 2 хода'), node('Неумирающий', 'Встаёт всегда: 50% → 25% → 10%')]],
    C: ['Бандит', [node('Добыча', '+10% золота за бой'), node('Кража', 'Удар крадёт золото (30%)'), node('Зелье', 'Снэтч может украсть зелье (20%)'), node('Знакомства', 'Скидка 10% в магазинах'), node('Ловкие руки', 'Каждый Снэтч крадёт и золото')]],
  },
  abilities: () => [
    {
      id: 'b_staff', name: 'Трёхсекционное копьё', label: 'Копьё', icon: I.sword, kind: 'basic', target: 'enemyAny', fx: 'melee', desc: 'Удар до любой цели.',
      run: (e, u, t) => {
        const n = e.hit(u, t!, 1.1);
        if (n > 0 && N(u, 'C2') && e.rnd() < 0.3) { e.res(u, 'gold', 5 * e.s.region); e.float(u, '+золото', '#ffd75a'); }
      },
    },
    {
      id: 'b_snatch', name: 'Снэтч', label: 'Снэтч', icon: 'icons/snatch', kind: 'skill', target: 'enemy', cost: 2, fx: 'melee',
      desc: 'Удар и кража 15% силы цели себе на 3 хода.',
      run: (e, u, t) => {
        const v = N(u, 'A1') ? 20 : 15;
        for (const x of N(u, 'A5') ? e.enemies() : [t!]) {
          e.hit(u, x, 0.8, { single: x === t });
          if (!x.alive) continue;
          banSteal(e, u, x, v);
          if (N(u, 'A2')) e.dispel(x, 1);
          if (N(u, 'A3')) { e.add(x, 'slow', 3, 20); e.add(u, 'haste', 3, 20); }
          if (N(u, 'C5')) e.res(u, 'gold', 5 * e.s.region);
          if (N(u, 'C3') && e.rnd() < 0.2) { e.s.items.potion = (e.s.items.potion ?? 0) + 1; e.float(u, '+зелье', '#8dff7a'); }
        }
        if (N(u, 'A4')) { const w = e.alliesOf(u).filter((x) => x !== u).sort((a, b) => a.atk - b.atk)[0]; if (w) e.add(w, 'atkUp', 3, v); }
      },
    },
    { id: 'b_hunt', name: 'Физикал хант', label: 'Хант', icon: 'icons/hunt', kind: 'skill', target: 'allEnemies', cost: 3, fx: 'buff',
      desc: 'Крадёт скорость у всех врагов.',
      run: (e, u) => { for (const x of e.enemies()) e.add(x, 'slow', 3, 30); e.add(u, 'haste', 3, 30); } },
    { id: 'b_ult', name: 'Хантер фест', label: 'Фест', icon: 'icons/fest', kind: 'ult', target: 'allEnemies', fx: 'buff',
      desc: 'Крадёт силу у всех врагов сразу: им −25%, ему +25% за каждого.',
      run: (e, u) => { for (const x of e.enemies()) banSteal(e, u, x, 25); } },
  ],
  hooks: {
    battleStart: (_e, u) => { u.res.lives = N(u, 'B5') ? 99 : N(u, 'B3') ? 2 : 1; u.res.deaths = 0; },
    turnStart: (e, u) => { e.heal(u, u.maxHp * (N(u, 'B1') ? 0.08 : 0.05), true); },
    dealMult: (e) => (e.team('sins3') ? 1.15 : 1),
    onAnyDeath: (_e, u, v) => {
      if (v !== u || (u.res.lives ?? 0) <= 0) return;
      u.res.lives -= 1;
      const steps = [0.5, 0.25, 0.1];
      const p = N(u, 'B5') ? steps[Math.min(2, u.res.deaths ?? 0)] : N(u, 'B2') ? 0.4 : 0.25;
      u.res.deaths = (u.res.deaths ?? 0) + 1;
      u.statuses.push({ id: 'rising', turns: 99, value: p });
    },
    onExpire: (e, u, st) => { if (st.id === 'rising' && N(u, 'B4')) e.add(u, 'taunt', 2, 1); },
  },
});

// ===================== Санраку =====================
hero({
  key: 'sunraku', name: 'Санраку', nameAcc: 'Санраку', role: 'fighter', work: 'Шангри-Ла Фронтир', color: '#4bb3c8',
  hp: 85, atk: 11, def: 0, spd: 10, mp: 6, mpRegen: 2, mpName: 'Энергия', dodge: 0.25,
  passive: 'Птичья маска: уклонение 25%, но брони нет. Комбо: +5% урона за удар подряд, сброс при получении урона.',
  mods: { A1: { dodge: 0.05 } },
  tree: {
    A: ['Уклонение', [node('Рефлексы', '+5% уклонения'), node('Ритм', 'Уклонение даёт Комбо'), node('Контрвыпад', 'Контратака ×1,5'), node('Весь раунд', 'Первое Идеальное уклонение в бою держится до следующего хода'), node('Спидраннер', 'После уклонения — доп. ход, раз в раунд')]],
    B: ['Комбо', [node('Разгон', '+8% за стак Комбо'), node('Не сбивается', 'Первый пропущенный удар за раунд не сбрасывает Комбо'), node('Точка', 'От 5 стаков — всегда крит'), node('Длинная серия', '«Серия» — 6 ударов'), node('Безупречное комбо', 'При 10+ стаках «Серия» добивает всех ударом ×3')]],
    C: ['Эмуль', [node('Эмуль', 'Кролик-спутник лечит самого раненого на 5% в ход'), node('Магия Эмуль', 'Эмуль бьёт магией случайного врага'), node('Телепорт', 'Раз за бой Эмуль спасает союзника от смертельного удара'), node('Заботливая', 'Эмуль лечит 10%'), node('Чудо кролика', 'Раз за бой Эмуль поднимает павшего с 30%')]],
  },
  abilities: () => [
    { id: 'sr_blades', name: 'Двойные клинки', label: 'Клинки', icon: I.sword, kind: 'basic', target: 'enemy', fx: 'melee', desc: 'Два удара, каждый +1 Комбо.',
      run: (e, u, t) => { for (let i = 0; i < 2; i++) { const x = t!.alive ? t! : e.randFoes(u, 1)[0]; if (x) srHit(e, u, x, 0.6); } } },
    { id: 'sr_evade', name: 'Идеальное уклонение', label: 'Уклон', icon: 'icons/evade', kind: 'skill', target: 'self', cost: 1, fx: 'buff',
      desc: 'Уходит от следующего удара и контратакует.',
      run: (e, u) => {
        const round = N(u, 'A4') && !u.res.a4;
        u.res.a4 = 1;
        e.add(u, 'evadeNext', 1, 1, { round });
        e.add(u, 'counter', 1, N(u, 'A3') ? 1.5 : 1);
      } },
    { id: 'sr_series', name: 'Серия', label: 'Серия', icon: 'icons/series', kind: 'skill', target: 'enemy', cost: 2, fx: 'melee', desc: '4 удара, урон растёт от Комбо.',
      run: (e, u, t) => {
        for (let i = 0; i < (N(u, 'B4') ? 6 : 4); i++) { const x = t!.alive ? t! : e.randFoes(u, 1)[0]; if (x) srHit(e, u, x, 0.5); }
        if (N(u, 'B5') && (u.res.combo ?? 0) >= 10) { u.res.combo -= 10; for (const x of e.enemies()) e.hit(u, x, 3, { single: false, sure: true }); }
      } },
    { id: 'sr_ult', name: 'Предельная концентрация', label: 'Фокус', icon: 'icons/focus', kind: 'ult', target: 'self', fx: 'buff',
      desc: '2 хода подряд, все удары — криты.',
      run: (e, u) => { e.add(u, 'focus', 3, 1); e.s.extra.push(u.uid, u.uid); e.float(u, '2 хода!', '#7fffd4'); } },
  ],
  hooks: {
    dealMult: (_e, u) => 1 + (u.res.combo ?? 0) * (N(u, 'B1') ? 0.08 : 0.05),
    onDamaged: (_e, u) => { if (N(u, 'B2') && !u.res.b2) { u.res.b2 = 1; return; } u.res.combo = 0; },
    roundStart: (_e, u) => { u.res.b2 = 0; u.res.a5 = 0; },
    onDodge: (e, u) => {
      if (N(u, 'A2')) e.res(u, 'combo', 1, 20);
      if (N(u, 'A5') && !u.res.a5) { u.res.a5 = 1; e.extraTurn(u); }
    },
    turnStart: (e, u) => {
      if (!N(u, 'C1')) return;
      const w = mostWounded(e, u);
      if (w && w.hp < w.maxHp) e.heal(w, w.maxHp * (N(u, 'C4') ? 0.1 : 0.05), true);
      if (N(u, 'C2')) { const t = e.randFoes(u, 1)[0]; if (t) e.hit(u, t, 0.6, { magic: true, type: 'wind', single: false }); }
      if (N(u, 'C5') && !u.res.c5) {
        const d = e.alliesOf(u, true).find((x) => !x.alive);
        if (d) { u.res.c5 = 1; e.revive(d, 0.3); e.float(d, 'Эмуль!', '#ffffff'); }
      }
    },
    onAllyFatal: (e, u, ally) => {
      if (!N(u, 'C3') || u.res.c3 || !u.alive || ally.side !== u.side) return false;
      u.res.c3 = 1;
      e.float(ally, 'телепорт Эмуль', '#ffffff');
      return true;
    },
    resLine: (_e, u) => `Комбо: ${u.res.combo ?? 0}`,
  },
});
function srHit(e: Engine, u: Unit, t: Unit, p: number): void {
  const crit = N(u, 'B3') && (u.res.combo ?? 0) >= 5 ? 1 : 0;
  const n = e.hit(u, t, p, { crit });
  if (n > 0) e.res(u, 'combo', 1, 20);
}
